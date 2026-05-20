import {
  buildDeterministicSummary,
  type Thread,
  type ThreadLocale,
  type ThreadMessage,
  type ThreadPurpose,
} from "./threadStore.ts"
import {
  buildSystemPromptFor,
  parseReadySignalFor,
  type ChangeMotivation,
  type ConstraintOverrides,
  type UserContextProfile,
  type ValidatorRejection,
} from "./prompt/index.ts"
import {
  buildLastPreview,
  extractRenderedFromMcpResult,
  type DraftArgs,
  type DraftConstraintOverrides,
  type DraftResult,
  type LastPreview,
} from "./draft.ts"
import {
  BundleSizeExceeded,
  buildBundleSummary,
  ProfileMissing,
  type AdditionalProgramBundle,
} from "./lib/bundle.ts"
import type { CallMcpToolResult } from "../_shared/mcpClient.ts"
import type { LogEvent } from "./log.ts"

export type { LogEvent } from "./log.ts"

const SUPPORTED_LOCALES: readonly ThreadLocale[] = ["en", "fr"] as const

function isSupportedLocale(value: unknown): value is ThreadLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export interface ChatModelInput {
  systemPrompt: string
  messages: ThreadMessage[]
  // #358 — Fired once per retry that the chat model performs against the
  // upstream provider. Handler binds this to a structured `provider_retry`
  // warn log so we can observe whether retries are actually saving us or
  // just delaying the inevitable. Implementations that don't retry simply
  // never call it.
  onRetry?: (info: { attempt: number; upstreamStatus: number }) => void
}

export interface ChatModelOutput {
  content: string
}

export interface DraftStepInput {
  userId: string
  locale: ThreadLocale
  thread: Thread
  profile: UserContextProfile
  // T134 (#343) — populated only for additional_program threads.
  // Onboarding always passes `undefined`. Forwarded verbatim to
  // `runProgramDraftStep` which merges them on top of profile constraints.
  constraintOverrides?: DraftConstraintOverrides
}

export interface EmbeddedAgentDeps {
  getUser: (authHeader: string) => Promise<{ userId: string } | null>
  getActiveThread: (userId: string, purpose: ThreadPurpose) => Promise<Thread | null>
  getOrCreateActiveThread: (
    userId: string,
    locale: ThreadLocale,
    purpose: ThreadPurpose,
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
  /**
   * Lazy 90d retention sweep keyed on user_id. Called once per
   * authenticated request (T122). Implementation lives in
   * `threadStore.purgeDueForUser` and uses a single conditional UPDATE
   * — no per-row fetch.
   */
  purgeRetention: (userId: string) => Promise<void>
  /**
   * T133 (#343) — build the additional-program bundle on first `/open` for
   * a thread whose `bundle_context` is null. Resolves to a frozen snapshot
   * of profile + active program summary + 28d stats; throws `ProfileMissing`
   * (handler → 409) or `BundleSizeExceeded` (handler → 500 + error log).
   * Onboarding flow never touches this dep.
   */
  buildBundle: (userId: string) => Promise<AdditionalProgramBundle>
  /**
   * T133 (#343) — persist a built bundle into the thread row's
   * `bundle_context` JSONB. Idempotent (no-op when the row already has
   * one — caller guards on null).
   */
  setBundle: (thread: Thread, bundle: AdditionalProgramBundle) => Promise<void>
  /**
   * T134 (#343) — bump `validator_rejection_count` by 1 when the
   * additional-program /send validator rejects a malformed ready signal.
   * Used downstream by the agent's bounded retry mechanic.
   */
  incrementValidatorRejection: (thread: Thread) => Promise<void>
  /**
   * T134 (#343) — write the first-accepted `change_motivation` for an
   * additional-program thread. Caller enforces first-accept-only.
   */
  setChangeMotivation: (thread: Thread, motivation: ChangeMotivation) => Promise<void>
  /**
   * T134 (#343) — overwrite `pending_constraint_overrides`. Pass `null`
   * to clear (latest accepted wins; if a later signal has no overrides
   * we drop the stale value).
   */
  setPendingConstraintOverrides: (
    thread: Thread,
    overrides: ConstraintOverrides | null,
  ) => Promise<void>
  /**
   * T134 (#343) — clear `pending_constraint_overrides` after /draft has
   * consumed them. Race-safe: even if MCP fails later and the user
   * retries, /draft falls back to profile defaults (the agent must
   * re-emit overrides to re-apply).
   */
  consumePendingOverrides: (thread: Thread) => Promise<void>
  log: (event: LogEvent) => void
}

const VALID_DRAFT_TRIGGERS = ["ready_signal", "turn_cap", "user_cta"] as const
type DraftTrigger = typeof VALID_DRAFT_TRIGGERS[number]

function isDraftTrigger(value: unknown): value is DraftTrigger {
  return typeof value === "string" && (VALID_DRAFT_TRIGGERS as readonly string[]).includes(value)
}

const VALID_PURPOSES: readonly ThreadPurpose[] = ["onboarding", "additional_program"] as const

interface PurposeResolution {
  purpose: ThreadPurpose
  defaulted: boolean
}

/**
 * Resolve `body.purpose` to a `ThreadPurpose`. Three outcomes:
 *
 *  - explicit valid value → returned verbatim.
 *  - missing (`undefined` / not a string) → defaults to `'onboarding'` with
 *    `defaulted: true` so the caller can emit the back-compat warn log.
 *    Covers stale tabs from the pre-T131 client that didn't send `purpose`.
 *  - unknown string → returns `null` so the caller can 400 with
 *    `invalid_purpose`.
 */
function resolvePurpose(raw: unknown): PurposeResolution | null {
  if (raw === undefined || raw === null) {
    return { purpose: "onboarding", defaulted: true }
  }
  if (typeof raw !== "string") return null
  if ((VALID_PURPOSES as readonly string[]).includes(raw)) {
    return { purpose: raw as ThreadPurpose, defaulted: false }
  }
  return null
}

export async function handleEmbeddedAgent(
  req: Request,
  deps: EmbeddedAgentDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 })
  }

  // PR review #5: propagate `x-request-id` from the client when present so
  // browser → edge logs share an id (mirrors `mcp-phase-a-proof`'s handler).
  // Falls back to a fresh UUID when the header is absent (Deno fetch tests,
  // direct curl, etc.).
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()
  const authHeader = req.headers.get("Authorization") ?? ""
  const user = await deps.getUser(authHeader)
  if (!user) {
    // Route attribution at this top-level guard is "/thread" by convention
    // (matches the legacy log shape from T117). Action-specific routes
    // can't be inferred reliably yet — `body` hasn't been parsed.
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/thread",
      error_kind: "auth_missing",
      request_id: requestId,
    })
    return Response.json({ error: "auth_missing" }, { status: 401 })
  }

  // Lazy 90d retention purge — best-effort, never fails the request.
  // Lives at the top of the handler (post-auth) so every authenticated
  // touch eventually sweeps the user's terminal threads, fulfilling the
  // T121 "raw text is purged after 90 days" promise without a cron.
  await deps.purgeRetention(user.userId).catch((err) => {
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/thread",
      error_kind: "retention_purge_failed",
      request_id: requestId,
      user_id: user.userId,
      message: err instanceof Error ? err.message : String(err),
    })
  })

  // PR review #3: `req.json()` throws on malformed JSON / empty body, which
  // would surface as an unstructured 500 with no log line. Catch the parse
  // failure here, emit a structured warn (so observability picks it up the
  // same way other 4xx do), and return a clean 400.
  let body: {
    action?: unknown
    locale?: unknown
    confirm?: unknown
    purpose?: unknown
  }
  try {
    body = await req.json() as {
      action?: unknown
      locale?: unknown
      confirm?: unknown
      purpose?: unknown
    }
  } catch (err) {
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/thread",
      error_kind: "invalid_json",
      request_id: requestId,
      user_id: user.userId,
      message: err instanceof Error ? err.message : String(err),
    })
    return Response.json({ error: "invalid_json" }, { status: 400 })
  }

  // T131 (#343) — resolve `purpose` once at the top so every action handler
  // receives a typed value. Missing `purpose` defaults to 'onboarding' for
  // back-compat with stale tabs running the pre-T131 client; an unknown
  // value 400s up front rather than poisoning downstream dispatch.
  const purposeResult = resolvePurpose(body.purpose)
  if (!purposeResult) {
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/thread",
      error_kind: "invalid_purpose",
      request_id: requestId,
      user_id: user.userId,
      message: `unknown purpose: ${typeof body.purpose === "string" ? body.purpose : "<non-string>"}`,
    })
    return Response.json({ error: "invalid_purpose" }, { status: 400 })
  }
  const { purpose, defaulted: purposeDefaulted } = purposeResult
  if (purposeDefaulted) {
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/thread",
      purpose,
      error_kind: "missing_purpose_default_applied",
      request_id: requestId,
      user_id: user.userId,
    })
  }

  if (body.action === "abandon") {
    return await handleAbandon(user.userId, purpose, deps, requestId)
  }

  if (body.action === "open") {
    return await handleOpen(user.userId, body.locale, purpose, deps, requestId)
  }

  if (body.action === "send") {
    return await handleSend(user.userId, body, purpose, deps, requestId)
  }

  if (body.action === "draft") {
    return await handleDraft(user.userId, body, purpose, deps, requestId)
  }

  if (body.action === "reject") {
    return await handleReject(user.userId, purpose, deps, requestId)
  }

  if (body.action === "commit") {
    return await handleCommit(user.userId, body, purpose, deps, requestId)
  }

  // Unknown action: classified as `internal` per the T122 inventory — we
  // don't enumerate every misbehaving client. Route attribution is "/thread"
  // since the action couldn't be dispatched to a real route.
  deps.log({
    level: "warn",
    feature: "embedded-agent",
    route: "/thread",
    purpose,
    error_kind: "internal",
    request_id: requestId,
    user_id: user.userId,
    message: `unknown action: ${typeof body.action === "string" ? body.action : "<non-string>"}`,
  })
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
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  const logWarn = (error_kind: string, thread_id?: string) =>
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/commit",
      purpose,
      error_kind,
      request_id: requestId,
      user_id: userId,
      thread_id,
    })

  // Defense in depth. The UI never POSTs without `confirm: true`, but the
  // commit gate is a server-trusted invariant — never derive consent from
  // "the request reached this route" alone.
  if (body.confirm !== true) {
    logWarn("confirm_required")
    return Response.json({ error: "invalid_confirm" }, { status: 400 })
  }

  const active = await deps.getActiveThread(userId, purpose)
  if (!active) {
    logWarn("no_active_thread")
    return Response.json({ error: "no_active_thread" }, { status: 409 })
  }
  if (active.status !== "preview_ready") {
    logWarn("wrong_status", active.id)
    return Response.json({ error: "not_preview_ready" }, { status: 409 })
  }
  const previewArgs = extractPreviewArgs(active.last_preview)
  if (!previewArgs) {
    // Same canonical kind as a wrong status — both represent "the
    // server-trusted precondition for committing isn't met". The wire
    // contract differentiates (`no_preview` vs `not_preview_ready`) for
    // the client; the log doesn't need to.
    logWarn("wrong_status", active.id)
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
      route: "/commit",
      purpose,
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
    // Folded into `mcp_tool_error` per the T122 canonical inventory —
    // a "succeeded but unparseable" response is a tool-side contract
    // break, not a transport failure.
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "/commit",
      purpose,
      error_kind: "mcp_tool_error",
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
      message: "create_program returned no program_id",
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

  // Boundary info — one line per program created. Volume capped by the
  // 5/30d program quota so this is a sustainable signal for funnel
  // analysis without spamming the log.
  deps.log({
    level: "info",
    feature: "embedded-agent",
    route: "/commit",
    purpose,
    request_id: requestId,
    user_id: userId,
    thread_id: active.id,
    message: "thread_committed",
  })

  // T136 (#343) — surface `thread_id` + `change_motivation` so the client
  // can fire `embedded_agent_preview_committed` with the same correlation
  // identifiers the funnel events use. `motivation` is non-null only on
  // additional_program threads that completed the motivation gate; for
  // onboarding it stays null and the analytics consumer omits the field.
  return Response.json(
    {
      program_id: programId,
      thread_id: active.id,
      motivation: active.change_motivation,
    },
    { status: 200 },
  )
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
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  const active = await deps.getActiveThread(userId, purpose)
  if (!active || active.status !== "preview_ready") {
    // Idempotent on the wire (200/{ok:true}) but worth a warn for
    // observability — a /reject from a non-preview state usually means
    // the client is racing /commit or a tab refresh, both of which are
    // recoverable but interesting to count.
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/reject",
      purpose,
      error_kind: "wrong_status",
      request_id: requestId,
      user_id: userId,
      thread_id: active?.id,
    })
    return Response.json({ ok: true, status: "open" }, { status: 200 })
  }
  await deps.resetForReject(active)
  // T134 (#343) — rejected previews must NOT leave their overrides
  // dangling: a subsequent /draft would silently re-apply them, surprising
  // the user. Clear unconditionally for additional_program (no-op when
  // the column was already null).
  if (purpose === "additional_program") {
    await deps.setPendingConstraintOverrides(active, null)
  }
  return Response.json({ ok: true, status: "open" }, { status: 200 })
}

async function handleAbandon(
  userId: string,
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  const active = await deps.getActiveThread(userId, purpose)
  if (active) {
    await deps.setStatusToAbandoned(active)
    // Boundary info — distinguishes user-driven abandon (this path)
    // from the lazy 7d auto-abandon in `markStaleIfDue`. Useful for
    // the funnel: voluntary drop-off vs ghost session.
    deps.log({
      level: "info",
      feature: "embedded-agent",
      route: "/thread",
      purpose,
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
      message: "thread_abandoned",
    })
  }
  return Response.json({ ok: true }, { status: 200 })
}

async function handleSend(
  userId: string,
  body: { content?: unknown; locale?: unknown },
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  const logWarn = (error_kind: string, thread_id?: string) =>
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/message",
      purpose,
      error_kind,
      request_id: requestId,
      user_id: userId,
      thread_id,
    })

  if (!isSupportedLocale(body.locale)) {
    logWarn("invalid_locale")
    return Response.json({ error: "invalid_locale" }, { status: 400 })
  }
  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    // `invalid_content` isn't in the canonical inventory — fold it into
    // `internal` since it's a malformed-input 400, the same bucket as
    // unknown actions on the main router.
    logWarn("internal")
    return Response.json({ error: "invalid_content" }, { status: 400 })
  }
  const locale = body.locale
  const content = body.content

  const active = await deps.getActiveThread(userId, purpose)
  if (!active || (active.status !== "open" && active.status !== "preview_ready")) {
    logWarn("no_active_thread", active?.id)
    return Response.json({ error: "no_active_thread" }, { status: 409 })
  }

  // T134 (#343) — additional-program threads MUST have a bundle by the
  // time /send runs. /open is the only writer; absence here means the
  // client raced past /open (stale tab) or the row was hand-edited. 409
  // forces a re-open instead of generating a draft from thin air.
  if (purpose === "additional_program" && active.bundle_context === null) {
    logWarn("bundle_missing", active.id)
    return Response.json({ error: "bundle_missing" }, { status: 409 })
  }

  // Persist-first: user message lands BEFORE quota / model so abandoned
  // attempts still leave evidence in the transcript (Story 19).
  const afterUser = await deps.appendMessage(active, "user", content)

  const quota = await deps.enforceTurnQuota(userId)
  if (!quota.allowed) {
    logWarn("turn_quota_exceeded", active.id)
    return Response.json(
      { error: "turn_quota_exceeded", limit: quota.limit, used: quota.used },
      { status: 429 },
    )
  }

  const systemPrompt = await buildSendSystemPrompt(userId, locale, purpose, active, deps)

  // log_everything: counted against quota even if the model fails (Story 19).
  // Wrapping in try/finally keeps the count consistent without leaking
  // provider error details to the caller.
  let modelOutput: ChatModelOutput
  try {
    modelOutput = await deps.chatModel({
      systemPrompt,
      messages: afterUser.messages ?? [],
      // #358 — Each retry emits a structured warn log so we can spot
      // "we saved a turn from a 503" vs "we just delayed the inevitable"
      // in the Supabase Function logs. Same request_id/user_id/thread_id
      // shape as `provider_failure` so the two events correlate trivially.
      onRetry: ({ attempt, upstreamStatus }) => {
        deps.log({
          level: "warn",
          feature: "embedded-agent",
          route: "/message",
          purpose,
          error_kind: "provider_retry",
          request_id: requestId,
          user_id: userId,
          thread_id: active.id,
          message: `attempt=${attempt} upstream_status=${upstreamStatus}`,
        })
      },
    })
  } catch (err) {
    await deps.logBillableCall(userId, "embedded_chat")
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "/message",
      purpose,
      error_kind: "provider_failure",
      request_id: requestId,
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
  const parsed = parseReadySignalFor(purpose, modelOutput.content)

  // T134 (#343) — additional-program flow: validator rejections bump a
  // counter + surface the reason to the client (so the UI can render a
  // hint; the agent retries through normal turns, not a server retry).
  // Accepted signals persist `change_motivation` (first wins) and
  // `pending_constraint_overrides` (latest wins).
  let validatorRejection: ValidatorRejection | undefined
  if (parsed.purpose === "additional_program") {
    const result = parsed.result
    if (result.validatorRejection) {
      validatorRejection = result.validatorRejection
      await deps.incrementValidatorRejection(active)
    } else if (result.ready) {
      await persistAcceptedAdditionalProgramSignal(active, result.motivation, result.constraintOverrides, deps)
    }
  }

  const afterAssistant = await deps.appendMessage(afterUser, "assistant", parsed.result.cleanContent)

  const responseBody: Record<string, unknown> = {
    assistant: {
      content: parsed.result.cleanContent,
      ts: latestAssistantTs(afterAssistant.messages),
    },
    ready_for_draft: parsed.result.ready,
  }
  if (validatorRejection) responseBody.validator_rejection = validatorRejection
  return Response.json(responseBody)
}

/**
 * Compose the system prompt for /send. Splits cleanly on purpose so the
 * onboarding path stays byte-identical to its pre-T134 shape (degraded
 * fallback included), while additional-program reads the bundle that
 * /open snapshotted into `thread.bundle_context`.
 */
async function buildSendSystemPrompt(
  userId: string,
  locale: ThreadLocale,
  purpose: ThreadPurpose,
  thread: Thread,
  deps: EmbeddedAgentDeps,
): Promise<string> {
  if (purpose === "onboarding") {
    const profile = await deps.loadProfile(userId)
    if (!profile) {
      // Degraded fallback preserved from the pre-T134 handler — keeps
      // onboarding alive when `user_profiles` is missing rather than
      // 5xx'ing the chat turn. The agent gets a locale hint and nothing
      // else, which is the same UX as a brand-new account.
      return `Always respond in ${locale === "fr" ? "French" : "English"}.`
    }
    return buildSystemPromptFor({ purpose: "onboarding", locale, userProfile: profile })
  }

  // additional_program — `bundle_context` is the source of truth; we
  // already 409'd above if it's missing.
  return buildSystemPromptFor({
    purpose: "additional_program",
    locale,
    bundle: thread.bundle_context as unknown as AdditionalProgramBundle,
  })
}

/**
 * Persist the accepted ready-signal payload for an additional-program
 * thread:
 *   - first-accept-only on `change_motivation` (the FIRST classification
 *     is canonical — see ADR 0003 §"Motivation gate enforcement");
 *   - latest-wins on `pending_constraint_overrides`, including clearing
 *     a stale value when the new signal carries none. `setPending`
 *     receiving `null` is an explicit no-overrides reset.
 */
async function persistAcceptedAdditionalProgramSignal(
  thread: Thread,
  motivation: ChangeMotivation | undefined,
  overrides: ConstraintOverrides | undefined,
  deps: EmbeddedAgentDeps,
): Promise<void> {
  if (motivation && thread.change_motivation === null) {
    await deps.setChangeMotivation(thread, motivation)
  }
  await deps.setPendingConstraintOverrides(thread, overrides ?? null)
}

function latestAssistantTs(messages: ThreadMessage[] | null): string {
  // Use the appended message's timestamp rather than `new Date()` so the
  // wire timestamp matches what we persisted (helps client-side reconciliation).
  if (!messages || messages.length === 0) return new Date().toISOString()
  const last = messages[messages.length - 1]
  return last?.ts ?? new Date().toISOString()
}

async function handleDraft(
  userId: string,
  body: { trigger?: unknown; locale?: unknown },
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  const logWarn = (error_kind: string, thread_id?: string) =>
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/draft",
      purpose,
      error_kind,
      request_id: requestId,
      user_id: userId,
      thread_id,
    })

  if (!isSupportedLocale(body.locale)) {
    logWarn("invalid_locale")
    return Response.json({ error: "invalid_locale" }, { status: 400 })
  }
  if (!isDraftTrigger(body.trigger)) {
    // Bad request from a misbehaving client — bucket as `internal`
    // (canonical inventory has no `invalid_trigger`).
    logWarn("internal")
    return Response.json({ error: "invalid_trigger" }, { status: 400 })
  }
  const locale = body.locale
  const trigger = body.trigger

  const active = await deps.getActiveThread(userId, purpose)
  if (!active || active.status !== "open") {
    // The wire still says `no_active_thread` (back-compat with the web
    // client). Canonical log kind is `wrong_status` since the route
    // only proceeds from `open`.
    logWarn("wrong_status", active?.id)
    return Response.json({ error: "no_active_thread" }, { status: 409 })
  }

  // Quota gates run BEFORE the model so a saturated user pays no token
  // cost on a request we already know we're going to reject. Order
  // matters: the embedded /24h cap is GymLogic-specific and cheaper to
  // count than the cross-source program quota, so we check it first.
  const draftQuota = await deps.enforceDraftQuota(userId)
  if (!draftQuota.allowed) {
    logWarn("draft_quota_exceeded", active.id)
    return Response.json(
      { error: "draft_quota_exceeded", limit: draftQuota.limit, used: draftQuota.used },
      { status: 429 },
    )
  }
  const programQuota = await deps.enforceProgramQuota(userId)
  if (!programQuota.allowed) {
    logWarn("program_quota_exceeded", active.id)
    return Response.json({ error: "program_quota_exceeded" }, { status: 429 })
  }

  const profile = await deps.loadProfile(userId)
  if (!profile) {
    // Folded into `wrong_status` — same as the active-thread guard above,
    // this is a precondition failure (user lacks a profile row). Wire
    // contract keeps `profile_missing` for the client.
    logWarn("wrong_status", active.id)
    return Response.json({ error: "profile_missing" }, { status: 409 })
  }

  // T134 (#343) — additional_program threads carry validated overrides
  // in `pending_constraint_overrides` (persisted from /send). The draft
  // step merges them on top of profile defaults; onboarding never sets
  // this field so the spread below is a no-op for that flow.
  const constraintOverrides = purpose === "additional_program"
    ? coercePendingOverrides(active.pending_constraint_overrides as Record<string, unknown> | null)
    : undefined

  // log_everything: count this draft attempt against the embedded_draft
  // quota whether it succeeds or not (Story 19). Wrapped so a model /
  // catalog failure still credits the cap.
  //
  // PR review #4: `runDraftStep` is the orchestration hub for catalog,
  // profile, history, validation and the model call. A try/finally only
  // covers the billable-log credit; if any of those dependencies throws
  // unexpectedly the handler crashes with a 500 and skips the canonical
  // `provider_failure` mapping/log line. We catch around the call too,
  // synthesize an `error: "internal"` DraftResult, and let the existing
  // `!draftResult.ok` branch turn it into the standard 502 + log.
  let draftResult: DraftResult | null = null
  let unexpectedDraftError: unknown = null
  try {
    draftResult = await deps.runDraftStep({
      userId,
      locale,
      thread: active,
      profile,
      constraintOverrides,
    })
  } catch (err) {
    unexpectedDraftError = err
  } finally {
    await deps.logBillableCall(userId, "embedded_draft").catch((err) => {
      // Logging failure must NOT mask a successful draft. We surface a
      // structured warn instead so observability can pick it up.
      deps.log({
        level: "warn",
        feature: "embedded-agent",
        route: "/draft",
        purpose,
        error_kind: "billable_log_failed",
        request_id: requestId,
        user_id: userId,
        thread_id: active.id,
        message: err instanceof Error ? err.message : String(err),
      })
    })
  }

  if (unexpectedDraftError || !draftResult) {
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "/draft",
      purpose,
      error_kind: "provider_failure",
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
      message: unexpectedDraftError instanceof Error
        ? `runDraftStep threw: ${unexpectedDraftError.message}`
        : `runDraftStep threw: ${String(unexpectedDraftError)}`,
    })
    return Response.json(
      { error: "draft_failed", reason: "internal", trigger },
      { status: 502 },
    )
  }

  if (!draftResult.ok) {
    // All draft-step failures (`no_catalog`, `empty_program`, model
    // schema mismatches) are bucketed as `provider_failure` per the
    // T122 canonical inventory. The original sub-kind survives in
    // `message` for debugging without polluting the kind taxonomy.
    deps.log({
      level: "error",
      feature: "embedded-agent",
      route: "/draft",
      purpose,
      error_kind: "provider_failure",
      request_id: requestId,
      user_id: userId,
      thread_id: active.id,
      message: draftResult.error,
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
      route: "/draft",
      purpose,
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

  // T134 (#343) — consume pending overrides AFTER the MCP dry_run + state
  // flip succeeds. If MCP fails earlier we keep the overrides so the user
  // can /reject + retry without losing them; if /draft itself errors we
  // never reach this line. Idempotent on null (consume → setNull).
  if (purpose === "additional_program" && constraintOverrides) {
    await deps.consumePendingOverrides(active)
  }

  return Response.json({ status: "preview_ready", preview, trigger })
}

/**
 * Defensive coercion of `thread.pending_constraint_overrides` (typed as
 * `Record<string, unknown>` in the row) into the DraftConstraintOverrides
 * shape. Returns `undefined` (skip overrides entirely) when the persisted
 * value is `null`, the wrong shape, or all keys would round-trip to
 * undefined — `runProgramDraftStep` treats undefined as "no overrides".
 *
 * The validator in /send is the source of truth for bounds; this is just
 * a runtime type guard against a stale row written by an older client.
 */
function coercePendingOverrides(
  raw: Record<string, unknown> | null,
): { daysPerWeek?: number; duration?: number; equipmentCategory?: string; goal?: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const out: { daysPerWeek?: number; duration?: number; equipmentCategory?: string; goal?: string } = {}
  if (typeof raw.daysPerWeek === "number") out.daysPerWeek = raw.daysPerWeek
  if (typeof raw.duration === "number") out.duration = raw.duration
  if (typeof raw.equipmentCategory === "string") out.equipmentCategory = raw.equipmentCategory
  if (typeof raw.goal === "string") out.goal = raw.goal
  return Object.keys(out).length === 0 ? undefined : out
}

async function handleOpen(
  userId: string,
  rawLocale: unknown,
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<Response> {
  if (!isSupportedLocale(rawLocale)) {
    deps.log({
      level: "warn",
      feature: "embedded-agent",
      route: "/thread",
      purpose,
      error_kind: "invalid_locale",
      request_id: requestId,
      user_id: userId,
    })
    return Response.json({ error: "invalid_locale" }, { status: 400 })
  }
  const locale = rawLocale

  const initial = await deps.getOrCreateActiveThread(userId, locale, purpose)
  const postStale = initial.resumed
    ? await refreshIfStale(initial.thread, userId, locale, purpose, deps, requestId)
    : initial

  // T133 (#343) — Bundle context is owned by the additional-program
  // thread for its entire lifetime. We build + persist once on the very
  // first /open (when `bundle_context` is null). Subsequent resumes
  // short-circuit on the null check and reuse the persisted snapshot.
  // Onboarding never enters this branch (no bundle in v1).
  const bundleResolution = await resolveBundleOnOpen(
    postStale.thread,
    userId,
    purpose,
    deps,
    requestId,
  )
  if ("error" in bundleResolution) return bundleResolution.error
  const { thread } = bundleResolution
  const resumed = postStale.resumed

  // Boundary info — exactly one line per /open response so onboarding
  // funnel queries can count "starts" cleanly. The `resumed` flag flips
  // the message between thread_created and thread_resumed instead of
  // emitting two events.
  deps.log({
    level: "info",
    feature: "embedded-agent",
    route: "/thread",
    purpose,
    request_id: requestId,
    user_id: userId,
    thread_id: thread.id,
    message: resumed ? "thread_resumed" : "thread_created",
  })

  const responseBody: Record<string, unknown> = {
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
  }

  if (purpose === "additional_program") {
    responseBody.bundle_summary = buildBundleSummary(thread.bundle_context)
  }

  return Response.json(responseBody, { status: 200 })
}

interface BundleResolutionOk {
  thread: Thread
}
interface BundleResolutionError {
  error: Response
}
type BundleResolution = BundleResolutionOk | BundleResolutionError

/**
 * Resolve the bundle for a /open response (T133, #343):
 *   - onboarding purpose, or a resumed additional-program thread that
 *     already has a bundle → return the thread unchanged.
 *   - fresh additional-program thread (bundle_context === null) → build,
 *     persist, return a thread with `bundle_context` populated locally
 *     (avoid a re-fetch round-trip).
 *   - `ProfileMissing` (user has no `user_profiles` row) → 409 +
 *     `profile_missing` log.
 *   - `BundleSizeExceeded` → 500 + `internal` error log. This is a
 *     builder bug (bundle shape is bounded by design) — a real incident,
 *     surfaced as a structured error so observability picks it up.
 */
async function resolveBundleOnOpen(
  thread: Thread,
  userId: string,
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<BundleResolution> {
  if (purpose !== "additional_program") return { thread }
  if (thread.bundle_context !== null) return { thread }

  try {
    const bundle = await deps.buildBundle(userId)
    await deps.setBundle(thread, bundle)
    return {
      thread: {
        ...thread,
        bundle_context: bundle as unknown as Record<string, unknown>,
      },
    }
  } catch (err) {
    if (err instanceof ProfileMissing) {
      deps.log({
        level: "warn",
        feature: "embedded-agent",
        route: "/thread",
        purpose,
        error_kind: "profile_missing",
        request_id: requestId,
        user_id: userId,
        thread_id: thread.id,
      })
      return {
        error: Response.json({ error: "profile_missing" }, { status: 409 }),
      }
    }
    if (err instanceof BundleSizeExceeded) {
      deps.log({
        level: "error",
        feature: "embedded-agent",
        route: "/thread",
        purpose,
        error_kind: "internal",
        request_id: requestId,
        user_id: userId,
        thread_id: thread.id,
        message: err.message,
      })
      return {
        error: Response.json({ error: "internal" }, { status: 500 }),
      }
    }
    throw err
  }
}

async function refreshIfStale(
  thread: Thread,
  userId: string,
  locale: ThreadLocale,
  purpose: ThreadPurpose,
  deps: EmbeddedAgentDeps,
  requestId: string,
): Promise<{ thread: Thread; resumed: boolean }> {
  const { stale } = await deps.markStaleIfDue(thread)
  if (!stale) return { thread, resumed: true }
  // Auto-abandon (lazy 7d sweep) deserves its own boundary line —
  // distinguishes silent expiry from an explicit user abandon when
  // analyzing funnel drop-off.
  deps.log({
    level: "info",
    feature: "embedded-agent",
    route: "/thread",
    purpose,
    request_id: requestId,
    user_id: userId,
    thread_id: thread.id,
    message: "thread_abandoned_stale",
  })
  return await deps.getOrCreateActiveThread(userId, locale, purpose)
}
