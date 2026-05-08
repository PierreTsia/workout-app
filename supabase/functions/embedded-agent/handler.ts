import {
  buildDeterministicSummary,
  type Thread,
  type ThreadLocale,
  type ThreadMessage,
} from "./threadStore.ts"
import {
  buildSystemPrompt,
  parseReadySignal,
  type UserContextProfile,
} from "./prompt.ts"
import {
  buildLastPreview,
  extractRenderedFromMcpResult,
  type DraftArgs,
  type DraftResult,
  type LastPreview,
} from "./draft.ts"
import type { CallMcpToolResult } from "../_shared/mcpClient.ts"

const SUPPORTED_LOCALES: readonly ThreadLocale[] = ["en", "fr"] as const

function isSupportedLocale(value: unknown): value is ThreadLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export interface LogEvent {
  level: "error" | "warn" | "info"
  feature: "embedded-agent"
  route: string
  error_kind?: string
  request_id: string
  user_id?: string
  thread_id?: string
  message?: string
}

export interface ChatModelInput {
  systemPrompt: string
  messages: ThreadMessage[]
}

export interface ChatModelOutput {
  content: string
}

export interface DraftStepInput {
  userId: string
  locale: ThreadLocale
  thread: Thread
  profile: UserContextProfile
}

export interface EmbeddedAgentDeps {
  getUser: (authHeader: string) => Promise<{ userId: string } | null>
  getActiveThread: (userId: string) => Promise<Thread | null>
  getOrCreateActiveThread: (
    userId: string,
    locale: ThreadLocale,
  ) => Promise<{ thread: Thread; resumed: boolean }>
  markStaleIfDue: (thread: Thread) => Promise<{ stale: boolean; thread: Thread }>
  setStatusToAbandoned: (thread: Thread) => Promise<void>
  appendMessage: (thread: Thread, role: "user" | "assistant", content: string) => Promise<Thread>
  enforceTurnQuota: (userId: string) => Promise<{ allowed: boolean; limit: number; used: number }>
  enforceDraftQuota: (userId: string) => Promise<{ allowed: boolean; limit: number; used: number }>
  enforceProgramQuota: (userId: string) => Promise<{ allowed: boolean }>
  logBillableCall: (userId: string, source: "embedded_chat" | "embedded_draft") => Promise<void>
  chatModel: (input: ChatModelInput) => Promise<ChatModelOutput>
  loadProfile: (userId: string) => Promise<UserContextProfile | null>
  runDraftStep: (input: DraftStepInput) => Promise<DraftResult>
  callMcp: (args: DraftArgs & { dry_run: boolean }) => Promise<CallMcpToolResult>
  setLastPreview: (thread: Thread, preview: LastPreview) => Promise<void>
  setStatusToPreviewReady: (thread: Thread) => Promise<void>
  bumpDraftCount24h: (thread: Thread) => Promise<void>
  resetForReject: (thread: Thread) => Promise<void>
  setStatusToCommitted: (
    thread: Thread,
    patch: { program_id: string; summary?: string },
  ) => Promise<void>
  log: (event: LogEvent) => void
}

const VALID_DRAFT_TRIGGERS = ["ready_signal", "turn_cap", "user_cta"] as const
type DraftTrigger = typeof VALID_DRAFT_TRIGGERS[number]

function isDraftTrigger(value: unknown): value is DraftTrigger {
  return typeof value === "string" && (VALID_DRAFT_TRIGGERS as readonly string[]).includes(value)
}

export async function handleEmbeddedAgent(
  req: Request,
  deps: EmbeddedAgentDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 })
  }

  const requestId = crypto.randomUUID()
  const authHeader = req.headers.get("Authorization") ?? ""
  const user = await deps.getUser(authHeader)
  if (!user) {
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "thread",
      error_kind: "auth_missing",
      request_id: requestId,
    })
    return Response.json({ error: "auth_missing" }, { status: 401 })
  }

  const body = await req.json() as { action?: unknown; locale?: unknown; confirm?: unknown }

  if (body.action === "abandon") {
    return await handleAbandon(user.userId, deps)
  }

  if (body.action === "open") {
    return await handleOpen(user.userId, body.locale, deps)
  }

  if (body.action === "send") {
    return await handleSend(user.userId, body, deps)
  }

  if (body.action === "draft") {
    return await handleDraft(user.userId, body, deps, requestId)
  }

  if (body.action === "reject") {
    return await handleReject(user.userId, deps)
  }

  if (body.action === "commit") {
    return await handleCommit(user.userId, body, deps, requestId)
  }

  return Response.json({ error: "invalid_action" }, { status: 400 })
}

/**
 * Close the onboarding program commit gate (Story 6 — agent proposes, user
 * decides). Server-trusted: `confirm: true` is the contract, `last_preview`
 * is the source of truth for what gets persisted, and MCP `create_program`
 * with `dry_run: false` is the only way a program row lands. On any MCP
 * failure the thread stays at `preview_ready` so the user can retry without
 * losing their draft.
 */
async function handleCommit(
  userId: string,
  body: { confirm?: unknown },
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  // Defense in depth. The UI never POSTs without `confirm: true`, but the
  // commit gate is a server-trusted invariant — never derive consent from
  // "the request reached this route" alone.
  if (body.confirm !== true) {
    return Response.json({ error: "invalid_confirm" }, { status: 400 })
  }

  const active = await deps.getActiveThread(userId)
  if (!active) {
    return Response.json({ error: "no_active_thread" }, { status: 409 })
  }
  if (active.status !== "preview_ready") {
    return Response.json({ error: "not_preview_ready" }, { status: 409 })
  }
  const previewArgs = extractPreviewArgs(active.last_preview)
  if (!previewArgs) {
    return Response.json({ error: "no_preview" }, { status: 409 })
  }

  // Lock-step with the MCP tool: dry_run: false here is the *only* place a
  // program row can be written from the embedded flow. /draft hard-codes
  // dry_run: true; the MCP server itself rejects writes when dry_run !== false.
  const mcpResult = await deps.callMcp({ ...previewArgs, dry_run: false })
  if (!mcpResult.ok) {
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "commit",
      error_kind: `mcp_${mcpResult.kind}`,
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
      message: "message" in mcpResult ? mcpResult.message : undefined,
    })
    return Response.json(
      { error: "commit_failed", kind: mcpResult.kind },
      { status: 502 },
    )
  }

  const programId = parseProgramIdFromMcpResult(mcpResult.value)
  if (!programId) {
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "commit",
      error_kind: "mcp_invalid_response",
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
    })
    return Response.json(
      { error: "commit_failed", kind: "invalid_response" },
      { status: 502 },
    )
  }

  // Summary is best-effort. If the profile fetch fails or returns null we
  // still commit the program (the user owns it) — we just skip the summary
  // sentence rather than block on a nice-to-have audit string.
  const profile = await deps.loadProfile(userId)
  const summary = profile
    ? buildDeterministicSummary({
        locale: active.locale ?? "en",
        profile,
        programDays: previewArgs.days.length,
        programExerciseCount: previewArgs.days.reduce(
          (sum, d) => sum + d.exercises.length,
          0,
        ),
      })
    : undefined

  await deps.setStatusToCommitted(active, { program_id: programId, summary })

  return Response.json({ program_id: programId }, { status: 200 })
}

interface PreviewArgs {
  name: string
  days: Array<{ label: string; exercises: string[] }>
}

/**
 * Defensive shape check for `last_preview.args`. We trust the server-side
 * /draft path to write a sane payload, but production data has a way of
 * surfacing edge cases (manual SQL fixups, schema drifts) — better to 409
 * than throw at the MCP boundary on a malformed payload.
 */
function extractPreviewArgs(lastPreview: Record<string, unknown> | null): PreviewArgs | null {
  if (!lastPreview) return null
  const args = (lastPreview as { args?: unknown }).args
  if (!args || typeof args !== "object") return null
  const a = args as Record<string, unknown>
  if (typeof a.name !== "string" || !Array.isArray(a.days)) return null
  return a as unknown as PreviewArgs
}

/**
 * Parse the `program_id` out of the MCP create_program success response.
 * The tool returns a single text content with a JSON body — we parse it
 * defensively and return null if the field is missing so the route can
 * surface a `commit_failed/invalid_response` 502 instead of a phantom id.
 */
function parseProgramIdFromMcpResult(
  result: { content?: Array<{ type: string; text?: string }> },
): string | null {
  const text = (result.content ?? [])
    .filter((c): c is { type: "text"; text: string } =>
      c?.type === "text" && typeof c.text === "string"
    )
    .map((c) => c.text)
    .join("\n")
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const id = parsed.program_id
    return typeof id === "string" && id.length > 0 ? id : null
  } catch {
    return null
  }
}

/**
 * Reject the stashed preview and put the thread back in `open` so the user
 * can keep chatting. Idempotent: a no-op when the active thread is already
 * `open` or absent. Locked behavior — clears `last_preview` (no half-state
 * `{open, last_preview: <stale>}`) and never injects a fake assistant turn.
 */
async function handleReject(
  userId: string,
  deps: EmbeddedAgentDeps,
): Promise<Response> {
  const active = await deps.getActiveThread(userId)
  if (active && active.status === "preview_ready") {
    await deps.resetForReject(active)
  }
  return Response.json({ ok: true, status: "open" }, { status: 200 })
}

async function handleAbandon(userId: string, deps: EmbeddedAgentDeps): Promise<Response> {
  const active = await deps.getActiveThread(userId)
  if (active) await deps.setStatusToAbandoned(active)
  return Response.json({ ok: true }, { status: 200 })
}

async function handleSend(
  userId: string,
  body: { content?: unknown; locale?: unknown },
  deps: EmbeddedAgentDeps,
): Promise<Response> {
  if (!isSupportedLocale(body.locale)) {
    return Response.json({ error: "invalid_locale" }, { status: 400 })
  }
  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return Response.json({ error: "invalid_content" }, { status: 400 })
  }
  const locale = body.locale
  const content = body.content

  const active = await deps.getActiveThread(userId)
  if (!active || (active.status !== "open" && active.status !== "preview_ready")) {
    return Response.json({ error: "no_active_thread" }, { status: 409 })
  }

  // Persist-first: user message lands BEFORE quota / model so abandoned
  // attempts still leave evidence in the transcript (Story 19).
  const afterUser = await deps.appendMessage(active, "user", content)

  const quota = await deps.enforceTurnQuota(userId)
  if (!quota.allowed) {
    return Response.json(
      { error: "turn_quota_exceeded", limit: quota.limit, used: quota.used },
      { status: 429 },
    )
  }

  const profile = await deps.loadProfile(userId)
  const systemPrompt = profile
    ? buildSystemPrompt({ locale, userProfile: profile })
    : `Always respond in ${locale === "fr" ? "French" : "English"}.`

  // log_everything: counted against quota even if the model fails (Story 19).
  // Wrapping in try/finally keeps the count consistent without leaking
  // provider error details to the caller.
  let modelOutput: ChatModelOutput
  try {
    modelOutput = await deps.chatModel({
      systemPrompt,
      messages: afterUser.messages ?? [],
    })
  } catch (err) {
    await deps.logBillableCall(userId, "embedded_chat")
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "message",
      error_kind: "model_failure",
      request_id: crypto.randomUUID(),
      user_id: userId,
      thread_id: active.id,
      message: err instanceof Error ? err.message : String(err),
    })
    return Response.json({ error: "model_failure" }, { status: 502 })
  }

  await deps.logBillableCall(userId, "embedded_chat")

  // Strip the ready-signal line server-side so neither the persisted
  // transcript nor the wire response ever leaks raw `READY_FOR_PROGRAM_DRAFT:
  // {...}` JSON to the client. The boolean below is the only thing the UI
  // needs to flip the "Generate my plan" CTA visual (T119).
  const signal = parseReadySignal(modelOutput.content)

  await deps.appendMessage(afterUser, "assistant", signal.cleanContent)
  const ts = new Date().toISOString()
  return Response.json({
    assistant: { content: signal.cleanContent, ts },
    ready_for_draft: signal.ready,
  })
}

async function handleDraft(
  userId: string,
  body: { trigger?: unknown; locale?: unknown },
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  if (!isSupportedLocale(body.locale)) {
    return Response.json({ error: "invalid_locale" }, { status: 400 })
  }
  if (!isDraftTrigger(body.trigger)) {
    return Response.json({ error: "invalid_trigger" }, { status: 400 })
  }
  const locale = body.locale
  const trigger = body.trigger

  const active = await deps.getActiveThread(userId)
  if (!active || active.status !== "open") {
    return Response.json({ error: "no_active_thread" }, { status: 409 })
  }

  // Quota gates run BEFORE the model so a saturated user pays no token
  // cost on a request we already know we're going to reject. Order
  // matters: the embedded /24h cap is GymLogic-specific and cheaper to
  // count than the cross-source program quota, so we check it first.
  const draftQuota = await deps.enforceDraftQuota(userId)
  if (!draftQuota.allowed) {
    return Response.json(
      { error: "draft_quota_exceeded", limit: draftQuota.limit, used: draftQuota.used },
      { status: 429 },
    )
  }
  const programQuota = await deps.enforceProgramQuota(userId)
  if (!programQuota.allowed) {
    return Response.json({ error: "program_quota_exceeded" }, { status: 429 })
  }

  const profile = await deps.loadProfile(userId)
  if (!profile) {
    return Response.json({ error: "profile_missing" }, { status: 409 })
  }

  // log_everything: count this draft attempt against the embedded_draft
  // quota whether it succeeds or not (Story 19). Wrapped so a model /
  // catalog failure still credits the cap.
  let draftResult: DraftResult
  try {
    draftResult = await deps.runDraftStep({ userId, locale, thread: active, profile })
  } finally {
    await deps.logBillableCall(userId, "embedded_draft").catch((err) => {
      // Logging failure must NOT mask a successful draft. We surface a
      // structured warn instead so observability can pick it up.
      deps.log({
        level: "warn",
        feature: "embedded-agent",
        route: "draft",
        error_kind: "billable_log_failed",
        request_id: requestId,
        user_id: userId,
        thread_id: active.id,
        message: err instanceof Error ? err.message : String(err),
      })
    })
  }

  if (!draftResult.ok) {
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "draft",
      error_kind: draftResult.error,
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
    })
    return Response.json({ error: "draft_failed", reason: draftResult.error, trigger }, { status: 502 })
  }

  // dry_run is hard-coded true here (locked decision: /draft never
  // persists; only /commit can write). The MCP tool refuses to write
  // anyway when dry_run !== false, but belt-and-braces.
  const mcpResult = await deps.callMcp({ ...draftResult.args, dry_run: true })
  if (!mcpResult.ok) {
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "draft",
      error_kind: `mcp_${mcpResult.kind}`,
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
      message: "message" in mcpResult ? mcpResult.message : undefined,
    })
    return Response.json({ error: "mcp_failed", reason: mcpResult.kind }, { status: 502 })
  }

  // Lift the per-day rendered echo lines out of the JSON-as-text MCP wrapper
  // into a structured `RenderedDay[]` the preview UI can render directly. If
  // the MCP response shape is unexpected (parser returns null) we degrade to
  // an args-only preview rather than failing the whole /draft.
  const renderedDays = extractRenderedFromMcpResult(mcpResult.value) ?? undefined
  const preview = buildLastPreview({ args: draftResult.args, rendered: renderedDays })

  await deps.setLastPreview(active, preview)
  await deps.setStatusToPreviewReady(active)
  await deps.bumpDraftCount24h(active)

  return Response.json({ status: "preview_ready", preview, trigger })
}

async function handleOpen(
  userId: string,
  rawLocale: unknown,
  deps: EmbeddedAgentDeps,
): Promise<Response> {
  if (!isSupportedLocale(rawLocale)) {
    return Response.json({ error: "invalid_locale" }, { status: 400 })
  }
  const locale = rawLocale

  const initial = await deps.getOrCreateActiveThread(userId, locale)
  const { thread, resumed } = initial.resumed
    ? await refreshIfStale(initial.thread, userId, locale, deps)
    : initial

  return Response.json(
    {
      thread_id: thread.id,
      status: thread.status,
      resumed,
      messages: thread.messages ?? [],
      // Surface last_preview so the EmbeddedAgentPreviewStep can render
      // straight from the thread query without a second round-trip. When
      // status !== preview_ready the field is null and the preview screen
      // never mounts in the first place — so the payload is small in
      // practice, and capped at 32 KB by buildLastPreview's size guard.
      last_preview: thread.last_preview ?? null,
    },
    { status: 200 },
  )
}

async function refreshIfStale(
  thread: Thread,
  userId: string,
  locale: ThreadLocale,
  deps: EmbeddedAgentDeps,
): Promise<{ thread: Thread; resumed: boolean }> {
  const { stale } = await deps.markStaleIfDue(thread)
  if (!stale) return { thread, resumed: true }
  return await deps.getOrCreateActiveThread(userId, locale)
}
