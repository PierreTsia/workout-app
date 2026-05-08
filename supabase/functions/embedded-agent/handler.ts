import type { Thread, ThreadLocale, ThreadMessage } from "./threadStore.ts"
import { buildSystemPrompt, type UserContextProfile } from "./prompt.ts"

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
  logBillableCall: (userId: string, source: "embedded_chat" | "embedded_draft") => Promise<void>
  chatModel: (input: ChatModelInput) => Promise<ChatModelOutput>
  loadProfile: (userId: string) => Promise<UserContextProfile | null>
  log: (event: LogEvent) => void
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

  const body = await req.json() as { action?: unknown; locale?: unknown }

  if (body.action === "abandon") {
    return await handleAbandon(user.userId, deps)
  }

  if (body.action === "open") {
    return await handleOpen(user.userId, body.locale, deps)
  }

  if (body.action === "send") {
    return await handleSend(user.userId, body, deps)
  }

  return Response.json({ error: "invalid_action" }, { status: 400 })
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

  await deps.appendMessage(afterUser, "assistant", modelOutput.content)
  const ts = new Date().toISOString()
  return Response.json({
    assistant: { content: modelOutput.content, ts },
    ready_for_draft: false,
  })
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
