import type { Thread, ThreadLocale } from "./threadStore.ts"

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

export interface EmbeddedAgentDeps {
  getUser: (authHeader: string) => Promise<{ userId: string } | null>
  getActiveThread: (userId: string) => Promise<Thread | null>
  getOrCreateActiveThread: (
    userId: string,
    locale: ThreadLocale,
  ) => Promise<{ thread: Thread; resumed: boolean }>
  markStaleIfDue: (thread: Thread) => Promise<{ stale: boolean; thread: Thread }>
  setStatusToAbandoned: (thread: Thread) => Promise<void>
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

  return Response.json({ error: "invalid_action" }, { status: 400 })
}

async function handleAbandon(userId: string, deps: EmbeddedAgentDeps): Promise<Response> {
  const active = await deps.getActiveThread(userId)
  if (active) await deps.setStatusToAbandoned(active)
  return Response.json({ ok: true }, { status: 200 })
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
