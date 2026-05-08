import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { handleEmbeddedAgent, type LogEvent } from "./handler.ts"
import type { Thread, ThreadLocale, ThreadMessage } from "./threadStore.ts"
import type { UserContextProfile } from "./prompt.ts"

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
  appendMessage: Array<{ thread: Thread; role: "user" | "assistant"; content: string }>
  enforceTurnQuota: Array<{ userId: string }>
  logBillableCall: Array<{ userId: string; source: "embedded_chat" | "embedded_draft" }>
  chatModel: Array<{ systemPrompt: string; messages: ThreadMessage[] }>
  loadProfile: Array<{ userId: string }>
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
  appendMessage?: (thread: Thread, role: "user" | "assistant", content: string) => Promise<Thread>
  enforceTurnQuota?: (userId: string) => Promise<{ allowed: boolean; limit: number; used: number }>
  logBillableCall?: (userId: string, source: "embedded_chat" | "embedded_draft") => Promise<void>
  chatModel?: (input: { systemPrompt: string; messages: ThreadMessage[] }) => Promise<{ content: string }>
  loadProfile?: (userId: string) => Promise<UserContextProfile | null>
}

function makeDeps(overrides: DepsOverrides = {}) {
  const calls: DepsCalls = {
    getUser: [],
    getActiveThread: [],
    getOrCreateActiveThread: [],
    markStaleIfDue: [],
    setStatusToAbandoned: [],
    appendMessage: [],
    enforceTurnQuota: [],
    logBillableCall: [],
    chatModel: [],
    loadProfile: [],
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
    appendMessage: async (thread: Thread, role: "user" | "assistant", content: string) => {
      calls.appendMessage.push({ thread, role, content })
      const ts = new Date("2026-05-08T12:00:00Z").toISOString()
      const next: Thread = {
        ...thread,
        messages: [...(thread.messages ?? []), { role, content, ts }],
      }
      if (overrides.appendMessage) return await overrides.appendMessage(thread, role, content)
      return next
    },
    enforceTurnQuota: async (userId: string) => {
      calls.enforceTurnQuota.push({ userId })
      return overrides.enforceTurnQuota
        ? await overrides.enforceTurnQuota(userId)
        : { allowed: true, limit: 40, used: 0 }
    },
    logBillableCall: async (userId: string, source: "embedded_chat" | "embedded_draft") => {
      calls.logBillableCall.push({ userId, source })
      if (overrides.logBillableCall) await overrides.logBillableCall(userId, source)
    },
    chatModel: async (input: { systemPrompt: string; messages: ThreadMessage[] }) => {
      calls.chatModel.push(input)
      return overrides.chatModel
        ? await overrides.chatModel(input)
        : { content: "Stub assistant reply." }
    },
    loadProfile: async (userId: string) => {
      calls.loadProfile.push({ userId })
      return overrides.loadProfile
        ? await overrides.loadProfile(userId)
        : {
            goal: "hypertrophy",
            experience: "intermediate",
            equipment: "gym",
            training_days_per_week: 4,
            session_duration_minutes: 60,
            age: 30,
            weight_kg: 75,
            gender: "male",
          }
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

function sendRequest(
  body: { content?: unknown; locale?: unknown },
  options: { withAuth?: boolean } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  return new Request("https://example.test/message", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "send", ...body }),
  })
}

// ---------- /message ----------

Deno.test("POST /message happy path persists user msg, calls model, persists assistant msg, returns shape", async () => {
  const active = makeThread({ id: "thread-active", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    chatModel: async () => ({ content: "Got it — let's talk about your back tightness." }),
  })

  const req = new Request("https://example.test/message", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer jwt_test" },
    body: JSON.stringify({ action: "send", content: "Hi, my back hurts.", locale: "en" }),
  })

  const res = await handleEmbeddedAgent(req, deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  const assistant = body.assistant as { content: string; ts: string }
  assertEquals(assistant.content, "Got it — let's talk about your back tightness.")
  assertEquals(typeof assistant.ts, "string")
  assertEquals(body.ready_for_draft, false)

  // Persist-first contract: user msg appended BEFORE quota / model call.
  assertEquals(calls.appendMessage.length, 2)
  assertEquals(calls.appendMessage[0].role, "user")
  assertEquals(calls.appendMessage[0].content, "Hi, my back hurts.")
  assertEquals(calls.appendMessage[1].role, "assistant")
  assertEquals(calls.appendMessage[1].content, "Got it — let's talk about your back tightness.")

  assertEquals(calls.enforceTurnQuota.length, 1)
  assertEquals(calls.chatModel.length, 1)
  assertEquals(calls.logBillableCall.length, 1)
  assertEquals(calls.logBillableCall[0].source, "embedded_chat")
})

Deno.test("POST /message returns 409 when there is no active thread (committed/abandoned/missing)", async () => {
  const { deps, calls } = makeDeps({ getActiveThread: async () => null })

  const res = await handleEmbeddedAgent(
    sendRequest({ content: "hi", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 409)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "no_active_thread")
  assertEquals(calls.appendMessage.length, 0)
  assertEquals(calls.chatModel.length, 0)
  assertEquals(calls.logBillableCall.length, 0)
})

Deno.test("POST /message returns 429 when quota is saturated, after the user message is persisted", async () => {
  const active = makeThread({ id: "t-1", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    enforceTurnQuota: async () => ({ allowed: false, limit: 40, used: 40 }),
  })

  const res = await handleEmbeddedAgent(
    sendRequest({ content: "hi", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 429)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "turn_quota_exceeded")
  assertEquals(body.limit, 40)
  assertEquals(body.used, 40)

  // Story 19: user message is persisted FIRST, even when the quota fires.
  assertEquals(calls.appendMessage.length, 1)
  assertEquals(calls.appendMessage[0].role, "user")
  assertEquals(calls.chatModel.length, 0)
  assertEquals(calls.logBillableCall.length, 0)
})

Deno.test("POST /message logs the billable call AND returns 502 even when the model throws (log_everything)", async () => {
  const active = makeThread({ id: "t-1", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    chatModel: async () => {
      throw new Error("upstream 503")
    },
  })

  const res = await handleEmbeddedAgent(
    sendRequest({ content: "hi", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 502)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "model_failure")

  // log_everything: quota row persists even on model failure.
  assertEquals(calls.logBillableCall.length, 1)
  assertEquals(calls.logBillableCall[0].source, "embedded_chat")

  // Assistant message is NOT appended on failure (only the user msg landed).
  assertEquals(calls.appendMessage.length, 1)
  assertEquals(calls.appendMessage[0].role, "user")

  assertEquals(calls.logEvents.length, 1)
  assertEquals(calls.logEvents[0].error_kind, "model_failure")
})

Deno.test("POST /message rejects empty content with 400 invalid_content", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(
    sendRequest({ content: "   ", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_content")
  assertEquals(calls.getActiveThread.length, 0)
  assertEquals(calls.appendMessage.length, 0)
})

Deno.test("POST /message rejects an unsupported locale with 400 invalid_locale", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(
    sendRequest({ content: "hi", locale: "es" }),
    deps,
  )

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_locale")
  assertEquals(calls.getActiveThread.length, 0)
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
