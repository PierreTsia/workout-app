import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { handleEmbeddedAgent, type LogEvent } from "./handler.ts"
import type { Thread, ThreadLocale } from "./threadStore.ts"

// ---------- factories ----------

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    user_id: "user-1",
    status: "open",
    messages: [],
    last_preview: null,
    locale: "en",
    program_id: null,
    summary: null,
    user_turn_count: 0,
    assistant_turn_count: 0,
    draft_count_24h: 0,
    created_at: new Date("2026-05-08T10:00:00Z"),
    updated_at: new Date("2026-05-08T10:00:00Z"),
    committed_at: null,
    abandoned_at: null,
    ...overrides,
  }
}

// ---------- deps factory ----------

interface DepsCalls {
  getUser: Array<{ authHeader: string }>
  getActiveThread: Array<{ userId: string }>
  getOrCreateActiveThread: Array<{ userId: string; locale: ThreadLocale }>
  markStaleIfDue: Array<{ thread: Thread }>
  setStatusToAbandoned: Array<{ thread: Thread }>
  logEvents: LogEvent[]
}

interface DepsOverrides {
  getUser?: (authHeader: string) => Promise<{ userId: string } | null>
  getActiveThread?: (userId: string) => Promise<Thread | null>
  getOrCreateActiveThread?: (
    userId: string,
    locale: ThreadLocale,
  ) => Promise<{ thread: Thread; resumed: boolean }>
  markStaleIfDue?: (thread: Thread) => Promise<{ stale: boolean; thread: Thread }>
  setStatusToAbandoned?: (thread: Thread) => Promise<void>
}

function makeDeps(overrides: DepsOverrides = {}) {
  const calls: DepsCalls = {
    getUser: [],
    getActiveThread: [],
    getOrCreateActiveThread: [],
    markStaleIfDue: [],
    setStatusToAbandoned: [],
    logEvents: [],
  }

  const deps = {
    getUser: async (authHeader: string) => {
      calls.getUser.push({ authHeader })
      return overrides.getUser
        ? await overrides.getUser(authHeader)
        : { userId: "user-1" }
    },
    getActiveThread: async (userId: string) => {
      calls.getActiveThread.push({ userId })
      return overrides.getActiveThread
        ? await overrides.getActiveThread(userId)
        : null
    },
    getOrCreateActiveThread: async (userId: string, locale: ThreadLocale) => {
      calls.getOrCreateActiveThread.push({ userId, locale })
      return overrides.getOrCreateActiveThread
        ? await overrides.getOrCreateActiveThread(userId, locale)
        : { thread: makeThread({ user_id: userId, locale }), resumed: false }
    },
    markStaleIfDue: async (thread: Thread) => {
      calls.markStaleIfDue.push({ thread })
      return overrides.markStaleIfDue
        ? await overrides.markStaleIfDue(thread)
        : { stale: false, thread }
    },
    setStatusToAbandoned: async (thread: Thread) => {
      calls.setStatusToAbandoned.push({ thread })
      if (overrides.setStatusToAbandoned) await overrides.setStatusToAbandoned(thread)
    },
    log: (event: LogEvent) => {
      calls.logEvents.push(event)
    },
  }

  return { deps, calls }
}

function jsonRequest(
  body: Record<string, unknown>,
  options: { withAuth?: boolean; method?: string } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  const method = options.method ?? "POST"
  return new Request("https://example.test/thread", {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  })
}

// ---------- /thread open ----------

Deno.test("POST /thread { open, en } returns the freshly created thread shape", async () => {
  const newThread = makeThread({ id: "thread-fresh", user_id: "user-1", locale: "en" })
  const { deps, calls } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: newThread, resumed: false }),
  })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "en" }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.thread_id, "thread-fresh")
  assertEquals(body.status, "open")
  assertEquals(body.resumed, false)
  assertEquals(body.messages, [])

  assertEquals(calls.getUser.length, 1)
  assertEquals(calls.getOrCreateActiveThread.length, 1)
  assertEquals(calls.getOrCreateActiveThread[0], { userId: "user-1", locale: "en" })
})

Deno.test("POST /thread { open } returns resumed:true when an active thread already exists", async () => {
  const existing = makeThread({ id: "thread-existing", status: "preview_ready" })
  const { deps } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: existing, resumed: true }),
  })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "en" }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.thread_id, "thread-existing")
  assertEquals(body.status, "preview_ready")
  assertEquals(body.resumed, true)
})

Deno.test("POST /thread { open } abandons a stale resumed thread and returns a fresh one", async () => {
  const stale = makeThread({ id: "thread-stale" })
  const fresh = makeThread({ id: "thread-fresh-after-stale" })

  let getOrCreateCalls = 0
  const { deps, calls } = makeDeps({
    getOrCreateActiveThread: async () => {
      getOrCreateCalls += 1
      return getOrCreateCalls === 1
        ? { thread: stale, resumed: true }
        : { thread: fresh, resumed: false }
    },
    markStaleIfDue: async (thread) => ({
      stale: true,
      thread: { ...thread, status: "abandoned" },
    }),
  })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "en" }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.thread_id, "thread-fresh-after-stale")
  assertEquals(body.resumed, false)
  assertEquals(calls.markStaleIfDue.length, 1)
  assertEquals(getOrCreateCalls, 2)
})

// ---------- /thread auth + validation ----------

Deno.test("POST /thread without a valid auth header returns 401 and logs a warn", async () => {
  const { deps, calls } = makeDeps({
    getUser: async () => null,
  })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "en" }), deps)

  assertEquals(res.status, 401)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "auth_missing")
  assertEquals(calls.getOrCreateActiveThread.length, 0)
  assertEquals(calls.logEvents.length, 1)
  assertEquals(calls.logEvents[0].error_kind, "auth_missing")
  assertEquals(calls.logEvents[0].route, "thread")
})

Deno.test("POST /thread with an unsupported locale returns 400 invalid_locale", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "es" }), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_locale")
  assertEquals(calls.getOrCreateActiveThread.length, 0)
})

// ---------- /thread abandon ----------

Deno.test("POST /thread { abandon } sets the active thread to abandoned and returns ok", async () => {
  const active = makeThread({ id: "thread-active" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
  })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "abandon" }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.ok, true)
  assertEquals(calls.setStatusToAbandoned.length, 1)
  assertEquals(calls.setStatusToAbandoned[0].thread.id, "thread-active")
  assertEquals(calls.getOrCreateActiveThread.length, 0)
})

Deno.test("POST /thread { abandon } is idempotent when there is no active thread", async () => {
  const { deps, calls } = makeDeps({ getActiveThread: async () => null })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "abandon" }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.ok, true)
  assertEquals(calls.setStatusToAbandoned.length, 0)
})

// ---------- /thread method + action validation ----------

Deno.test("POST /thread with an unknown action returns 400 invalid_action", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(jsonRequest({ action: "lol" }), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_action")
  assertEquals(calls.getOrCreateActiveThread.length, 0)
  assertEquals(calls.setStatusToAbandoned.length, 0)
})

Deno.test("GET /thread returns 405 method_not_allowed", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(
    jsonRequest({ action: "open", locale: "en" }, { method: "GET" }),
    deps,
  )

  assertEquals(res.status, 405)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "method_not_allowed")
  assertEquals(calls.getUser.length, 0)
})
