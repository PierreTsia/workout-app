import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { handleEmbeddedAgent, type LogEvent } from "./handler.ts"
import type { Thread, ThreadLocale, ThreadMessage } from "./threadStore.ts"
import type { UserContextProfile } from "./prompt.ts"
import type { DraftArgs, DraftResult, LastPreview } from "./draft.ts"
import type { CallMcpToolResult } from "../_shared/mcpClient.ts"

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
  enforceDraftQuota: Array<{ userId: string }>
  enforceProgramQuota: Array<{ userId: string }>
  logBillableCall: Array<{ userId: string; source: "embedded_chat" | "embedded_draft" }>
  chatModel: Array<{ systemPrompt: string; messages: ThreadMessage[] }>
  loadProfile: Array<{ userId: string }>
  runDraftStep: Array<{ userId: string; locale: ThreadLocale; thread: Thread }>
  callMcp: Array<{ args: DraftArgs }>
  setLastPreview: Array<{ thread: Thread; preview: LastPreview }>
  setStatusToPreviewReady: Array<{ thread: Thread }>
  bumpDraftCount24h: Array<{ thread: Thread }>
  resetForReject: Array<{ thread: Thread }>
  setStatusToCommitted: Array<{ thread: Thread; patch: { program_id: string; summary?: string } }>
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
  enforceDraftQuota?: (userId: string) => Promise<{ allowed: boolean; limit: number; used: number }>
  enforceProgramQuota?: (userId: string) => Promise<{ allowed: boolean }>
  logBillableCall?: (userId: string, source: "embedded_chat" | "embedded_draft") => Promise<void>
  chatModel?: (input: { systemPrompt: string; messages: ThreadMessage[] }) => Promise<{ content: string }>
  loadProfile?: (userId: string) => Promise<UserContextProfile | null>
  runDraftStep?: (input: { userId: string; locale: ThreadLocale; thread: Thread; profile: UserContextProfile }) => Promise<DraftResult>
  callMcp?: (args: DraftArgs) => Promise<CallMcpToolResult>
  setLastPreview?: (thread: Thread, preview: LastPreview) => Promise<void>
  setStatusToPreviewReady?: (thread: Thread) => Promise<void>
  bumpDraftCount24h?: (thread: Thread) => Promise<void>
  resetForReject?: (thread: Thread) => Promise<void>
  setStatusToCommitted?: (
    thread: Thread,
    patch: { program_id: string; summary?: string },
  ) => Promise<void>
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
    enforceDraftQuota: [],
    enforceProgramQuota: [],
    logBillableCall: [],
    chatModel: [],
    loadProfile: [],
    runDraftStep: [],
    callMcp: [],
    setLastPreview: [],
    setStatusToPreviewReady: [],
    bumpDraftCount24h: [],
    resetForReject: [],
    setStatusToCommitted: [],
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
    enforceDraftQuota: async (userId: string) => {
      calls.enforceDraftQuota.push({ userId })
      return overrides.enforceDraftQuota
        ? await overrides.enforceDraftQuota(userId)
        : { allowed: true, limit: 3, used: 0 }
    },
    enforceProgramQuota: async (userId: string) => {
      calls.enforceProgramQuota.push({ userId })
      return overrides.enforceProgramQuota
        ? await overrides.enforceProgramQuota(userId)
        : { allowed: true }
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
    runDraftStep: async (input: { userId: string; locale: ThreadLocale; thread: Thread; profile: UserContextProfile }) => {
      calls.runDraftStep.push({ userId: input.userId, locale: input.locale, thread: input.thread })
      return overrides.runDraftStep
        ? await overrides.runDraftStep(input)
        : ({
            ok: true,
            args: {
              name: "Hypertrophy — 4 days/wk",
              days: [{ label: "Day 1", exercises: ["ex-1"] }],
            },
          } as DraftResult)
    },
    callMcp: async (args: DraftArgs) => {
      calls.callMcp.push({ args })
      return overrides.callMcp
        ? await overrides.callMcp(args)
        : ({
            ok: true,
            value: { content: [{ type: "text", text: '{"dry_run": true, "days": []}' }] },
          } as CallMcpToolResult)
    },
    setLastPreview: async (thread: Thread, preview: LastPreview) => {
      calls.setLastPreview.push({ thread, preview })
      if (overrides.setLastPreview) await overrides.setLastPreview(thread, preview)
    },
    setStatusToPreviewReady: async (thread: Thread) => {
      calls.setStatusToPreviewReady.push({ thread })
      if (overrides.setStatusToPreviewReady) await overrides.setStatusToPreviewReady(thread)
    },
    bumpDraftCount24h: async (thread: Thread) => {
      calls.bumpDraftCount24h.push({ thread })
      if (overrides.bumpDraftCount24h) await overrides.bumpDraftCount24h(thread)
    },
    resetForReject: async (thread: Thread) => {
      calls.resetForReject.push({ thread })
      if (overrides.resetForReject) await overrides.resetForReject(thread)
    },
    setStatusToCommitted: async (
      thread: Thread,
      patch: { program_id: string; summary?: string },
    ) => {
      calls.setStatusToCommitted.push({ thread, patch })
      if (overrides.setStatusToCommitted) await overrides.setStatusToCommitted(thread, patch)
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

Deno.test("POST /thread { open } surfaces last_preview when status is preview_ready (so PreviewStep renders without a second fetch)", async () => {
  const previewPayload = {
    args: {
      name: "Hypertrophy — 4 d/wk",
      days: [{ label: "Push", exercises: ["ex-1"] }],
    },
    rendered: [{ label: "Push", lines: ["Bench Press — 4 × 8 × 80 kg total"] }],
  } as Record<string, unknown>
  const existing = makeThread({
    id: "t-pr",
    status: "preview_ready",
    last_preview: previewPayload,
  })
  const { deps } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: existing, resumed: true }),
  })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "en" }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.thread_id, "t-pr")
  assertEquals(body.status, "preview_ready")
  assertEquals(body.last_preview, previewPayload)
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

Deno.test("POST /message strips the READY_FOR_PROGRAM_DRAFT signal line and flips ready_for_draft when the model emits it", async () => {
  const active = makeThread({ id: "thread-active", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    chatModel: async () => ({
      content:
        "Sounds great, I have what I need.\n" +
        'READY_FOR_PROGRAM_DRAFT: {"ready":true,"summary":"Beginner female, 65, 3x/week."}',
    }),
  })

  const res = await handleEmbeddedAgent(
    sendRequest({ content: "Mon, Wed, Sat 45min.", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  const assistant = body.assistant as { content: string; ts: string }
  // Signal line is stripped from the wire payload — the client never sees raw JSON.
  assertEquals(assistant.content, "Sounds great, I have what I need.")
  assertEquals(body.ready_for_draft, true)

  // ...and stripped from what we persist into the transcript too (single source of truth).
  const assistantPersisted = calls.appendMessage.find((c) => c.role === "assistant")
  assertEquals(assistantPersisted?.content, "Sounds great, I have what I need.")
})

Deno.test("POST /message keeps ready_for_draft=false on free-text 'I'm ready' (no literal JSON line)", async () => {
  const active = makeThread({ id: "thread-active", status: "open" })
  const { deps } = makeDeps({
    getActiveThread: async () => active,
    chatModel: async () => ({ content: "I'm ready! Let's go!" }),
  })

  const res = await handleEmbeddedAgent(
    sendRequest({ content: "Sounds good.", locale: "en" }),
    deps,
  )

  const body = await res.json() as Record<string, unknown>
  assertEquals(body.ready_for_draft, false)
  const assistant = body.assistant as { content: string }
  assertEquals(assistant.content, "I'm ready! Let's go!")
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

// ---------- /draft ----------

function draftRequest(
  body: { trigger?: unknown; locale?: unknown },
  options: { withAuth?: boolean } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  return new Request("https://example.test/message", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "draft", ...body }),
  })
}

Deno.test("POST /draft happy path: invokes MCP create_program with dry_run, persists last_preview, flips status to preview_ready", async () => {
  const active = makeThread({ id: "thread-active", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
  })

  const res = await handleEmbeddedAgent(
    draftRequest({ trigger: "user_cta", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.status, "preview_ready")

  // Quota gates ran in the right order, before the model.
  assertEquals(calls.enforceDraftQuota.length, 1)
  assertEquals(calls.enforceProgramQuota.length, 1)
  assertEquals(calls.runDraftStep.length, 1)
  assertEquals(calls.runDraftStep[0].locale, "en")

  // MCP was called with dry_run: true and the args produced by runDraftStep.
  assertEquals(calls.callMcp.length, 1)
  const mcpArgsAny = calls.callMcp[0].args as unknown as Record<string, unknown>
  assertEquals(mcpArgsAny.name, "Hypertrophy — 4 days/wk")

  // Persistence side effects fired in order.
  assertEquals(calls.setLastPreview.length, 1)
  assertEquals(calls.setStatusToPreviewReady.length, 1)
  assertEquals(calls.bumpDraftCount24h.length, 1)
  assertEquals(calls.logBillableCall.length, 1)
  assertEquals(calls.logBillableCall[0].source, "embedded_draft")
})

Deno.test("POST /draft passes dry_run:true to MCP (locked — never persist from /draft)", async () => {
  const active = makeThread({ id: "thread-active", status: "open" })
  let mcpReceivedDryRun: unknown = null
  const { deps } = makeDeps({
    getActiveThread: async () => active,
    callMcp: async (args) => {
      // The route augments draftArgs with dry_run before calling MCP.
      // We capture that here to assert the safety guard is in place.
      mcpReceivedDryRun = (args as unknown as Record<string, unknown>).dry_run
      return { ok: true, value: { content: [{ type: "text", text: "{}" }] } }
    },
  })

  await handleEmbeddedAgent(draftRequest({ trigger: "user_cta", locale: "en" }), deps)

  assertEquals(mcpReceivedDryRun, true)
})

Deno.test("POST /draft returns 409 when the active thread is missing or already past 'open'", async () => {
  const { deps, calls } = makeDeps({
    getActiveThread: async () => makeThread({ id: "t-x", status: "preview_ready" }),
  })

  const res = await handleEmbeddedAgent(
    draftRequest({ trigger: "user_cta", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 409)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "no_active_thread")
  assertEquals(calls.runDraftStep.length, 0)
  assertEquals(calls.callMcp.length, 0)
})

Deno.test("POST /draft returns 429 draft_quota_exceeded when /24h cap is hit (and never calls the model)", async () => {
  const active = makeThread({ id: "t-x", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    enforceDraftQuota: async () => ({ allowed: false, limit: 3, used: 3 }),
  })

  const res = await handleEmbeddedAgent(
    draftRequest({ trigger: "user_cta", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 429)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "draft_quota_exceeded")
  assertEquals(body.limit, 3)
  assertEquals(body.used, 3)
  assertEquals(calls.runDraftStep.length, 0)
  assertEquals(calls.logBillableCall.length, 0)
})

Deno.test("POST /draft returns 429 program_quota_exceeded when the 5/30d program cap is hit", async () => {
  const active = makeThread({ id: "t-x", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    enforceProgramQuota: async () => ({ allowed: false }),
  })

  const res = await handleEmbeddedAgent(
    draftRequest({ trigger: "user_cta", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 429)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "program_quota_exceeded")
  assertEquals(calls.runDraftStep.length, 0)
})

Deno.test("POST /draft logs the billable call AND returns 502 when runDraftStep fails (log_everything)", async () => {
  const active = makeThread({ id: "t-x", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    runDraftStep: async () => ({ ok: false, error: "model_failure" }),
  })

  const res = await handleEmbeddedAgent(
    draftRequest({ trigger: "user_cta", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 502)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "draft_failed")
  assertEquals(calls.logBillableCall.length, 1)
  assertEquals(calls.logBillableCall[0].source, "embedded_draft")
  // Status stays open so the user can retry from chat.
  assertEquals(calls.setStatusToPreviewReady.length, 0)
})

Deno.test("POST /draft returns 502 on MCP transport error and keeps the thread status at 'open'", async () => {
  const active = makeThread({ id: "t-x", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    callMcp: async () => ({ ok: false, kind: "transport_error", message: "boom" }),
  })

  const res = await handleEmbeddedAgent(
    draftRequest({ trigger: "user_cta", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 502)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "mcp_failed")
  // Billable call still fires (we hit the model), but no state advance.
  assertEquals(calls.logBillableCall.length, 1)
  assertEquals(calls.setStatusToPreviewReady.length, 0)
})

Deno.test("POST /draft rejects an unsupported locale with 400 invalid_locale", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(draftRequest({ trigger: "user_cta", locale: "es" }), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_locale")
  assertEquals(calls.getActiveThread.length, 0)
})

Deno.test("POST /draft rejects an unknown trigger value with 400 invalid_trigger", async () => {
  const { deps } = makeDeps()

  const res = await handleEmbeddedAgent(draftRequest({ trigger: "yolo", locale: "en" }), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_trigger")
})

// ---------- /reject ----------
//
// Reject is the "user wasn't sold by the draft" escape from preview_ready
// back to chat. Locked behavior: status flips to `open`, last_preview is
// cleared, no fake assistant turn is injected (the user types whatever they
// want next and that becomes the next-draft signal). Idempotent at the
// route boundary so the client can fire-and-forget on Regenerate clicks.

function rejectRequest(options: { withAuth?: boolean } = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  return new Request("https://example.test/reject", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "reject" }),
  })
}

Deno.test("POST /reject flips preview_ready → open and clears last_preview", async () => {
  const active = makeThread({
    id: "t-pr",
    status: "preview_ready",
    last_preview: { args: { name: "x", days: [] } } as Record<string, unknown>,
  })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
  })

  const res = await handleEmbeddedAgent(rejectRequest(), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.ok, true)
  assertEquals(body.status, "open")
  assertEquals(calls.resetForReject.length, 1)
  assertEquals(calls.resetForReject[0].thread.id, "t-pr")
})

Deno.test("POST /reject is a silent no-op when the active thread is already 'open' (idempotent)", async () => {
  const active = makeThread({ id: "t-open", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
  })

  const res = await handleEmbeddedAgent(rejectRequest(), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.ok, true)
  assertEquals(body.status, "open")
  // No state mutation when status is already where reject would land.
  assertEquals(calls.resetForReject.length, 0)
})

Deno.test("POST /reject is a silent no-op when there is no active thread at all", async () => {
  const { deps, calls } = makeDeps({
    getActiveThread: async () => null,
  })

  const res = await handleEmbeddedAgent(rejectRequest(), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.ok, true)
  assertEquals(calls.resetForReject.length, 0)
})

Deno.test("POST /reject returns 401 when the auth header is missing", async () => {
  const { deps, calls } = makeDeps({
    getUser: async () => null,
  })

  const res = await handleEmbeddedAgent(rejectRequest({ withAuth: false }), deps)

  assertEquals(res.status, 401)
  assertEquals(calls.resetForReject.length, 0)
})

// ---------- /commit ----------
//
// Closes the onboarding program commit gate (Story 6 — agent proposes, user
// decides). Locked behavior:
//   - server-trusted gate: `confirm: true` is required, even though the UI
//     would never POST without it (defense in depth).
//   - state guard: only `preview_ready` threads with a stashed `last_preview`
//     can commit; anything else is 409.
//   - on success the thread becomes terminal `committed`, raw `messages` are
//     purged via `setStatus('committed')` (T116 retention behavior), and the
//     route returns the freshly-minted `program_id` so the client can route
//     to it.
//   - on MCP failure status STAYS `preview_ready` so the user retries commit
//     without losing the preview (T120 failure-mode table).

function commitRequest(
  body: Record<string, unknown> = { confirm: true },
  options: { withAuth?: boolean } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  return new Request("https://example.test/commit", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "commit", ...body }),
  })
}

const PREVIEW_READY_THREAD = (): Thread =>
  makeThread({
    id: "thread-pr",
    status: "preview_ready",
    locale: "en",
    last_preview: {
      args: {
        name: "Hypertrophy — 4 days/wk",
        days: [
          { label: "Day 1", exercises: ["ex-1", "ex-2"] },
          { label: "Day 2", exercises: ["ex-3"] },
        ],
      },
    } as Record<string, unknown>,
  })

function makeMcpCommitOk(programId: string): CallMcpToolResult {
  return {
    ok: true,
    value: {
      content: [{
        type: "text",
        text: JSON.stringify({
          dry_run: false,
          program_id: programId,
          workout_day_ids: ["d1", "d2"],
          message: "Program created and set active.",
        }),
      }],
    },
  }
}

Deno.test("POST /commit happy path: MCP dry_run:false, status → committed, summary built, returns program_id", async () => {
  const active = PREVIEW_READY_THREAD()
  let mcpReceived: Record<string, unknown> | null = null
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    callMcp: async (args) => {
      mcpReceived = args as unknown as Record<string, unknown>
      return makeMcpCommitOk("prog-123")
    },
  })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: true }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.program_id, "prog-123")

  // MCP called with dry_run: false and the persisted args.
  assertEquals(calls.callMcp.length, 1)
  const mcp = mcpReceived as Record<string, unknown> | null
  if (!mcp) throw new Error("expected MCP call")
  assertEquals(mcp.dry_run, false)
  assertEquals(mcp.name, "Hypertrophy — 4 days/wk")

  // Status transition with program_id + summary.
  assertEquals(calls.setStatusToCommitted.length, 1)
  assertEquals(calls.setStatusToCommitted[0].patch.program_id, "prog-123")
  // Summary is built from profile + program shape; we don't pin the exact
  // string here (that's exercised in threadStore_test.ts) — just verify the
  // route plumbs *some* summary through.
  const summary = calls.setStatusToCommitted[0].patch.summary
  assertEquals(typeof summary, "string")
  if (typeof summary === "string") {
    // Profile loadProfile returns goal=hypertrophy by default in this fixture.
    assertEquals(summary.includes("Hypertrophy"), true)
    assertEquals(summary.includes("Program: 2 days, 3 exercises"), true)
  }

  // Profile was loaded for summary composition.
  assertEquals(calls.loadProfile.length, 1)
  assertEquals(calls.loadProfile[0].userId, "user-1")
})

Deno.test("POST /commit returns 400 invalid_confirm when confirm !== true (server-trusted gate)", async () => {
  const active = PREVIEW_READY_THREAD()
  const { deps, calls } = makeDeps({ getActiveThread: async () => active })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: false }), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_confirm")
  // Defense in depth: no MCP call, no state mutation.
  assertEquals(calls.callMcp.length, 0)
  assertEquals(calls.setStatusToCommitted.length, 0)
})

Deno.test("POST /commit returns 400 invalid_confirm when confirm is missing entirely", async () => {
  const { deps, calls } = makeDeps({ getActiveThread: async () => PREVIEW_READY_THREAD() })

  const res = await handleEmbeddedAgent(commitRequest({}), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_confirm")
  assertEquals(calls.callMcp.length, 0)
})

Deno.test("POST /commit returns 409 no_active_thread when there is no active thread", async () => {
  const { deps, calls } = makeDeps({ getActiveThread: async () => null })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: true }), deps)

  assertEquals(res.status, 409)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "no_active_thread")
  assertEquals(calls.callMcp.length, 0)
})

Deno.test("POST /commit returns 409 not_preview_ready when status is still 'open'", async () => {
  const active = makeThread({ status: "open" })
  const { deps, calls } = makeDeps({ getActiveThread: async () => active })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: true }), deps)

  assertEquals(res.status, 409)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "not_preview_ready")
  assertEquals(calls.callMcp.length, 0)
})

Deno.test("POST /commit returns 409 no_preview when status is preview_ready but last_preview is missing", async () => {
  // Edge case — shouldn't happen with healthy data, but defensive: the
  // commit gate should not call MCP with empty args even if the row got
  // into a half-state somehow.
  const active = makeThread({ status: "preview_ready", last_preview: null })
  const { deps, calls } = makeDeps({ getActiveThread: async () => active })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: true }), deps)

  assertEquals(res.status, 409)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "no_preview")
  assertEquals(calls.callMcp.length, 0)
})

Deno.test("POST /commit returns 502 commit_failed and KEEPS status preview_ready on MCP transport error", async () => {
  const active = PREVIEW_READY_THREAD()
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    callMcp: async () => ({ ok: false, kind: "transport_error", message: "fetch died" }),
  })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: true }), deps)

  assertEquals(res.status, 502)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "commit_failed")
  assertEquals(body.kind, "transport_error")
  // Status sticks so the user can retry from the same preview.
  assertEquals(calls.setStatusToCommitted.length, 0)
})

Deno.test("POST /commit returns 502 commit_failed on MCP rpc_error and surfaces the kind", async () => {
  const active = PREVIEW_READY_THREAD()
  const { deps } = makeDeps({
    getActiveThread: async () => active,
    callMcp: async () => ({
      ok: false,
      kind: "rpc_error",
      rpc: { code: -32600, message: "Invalid Request" },
    }),
  })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: true }), deps)

  assertEquals(res.status, 502)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "commit_failed")
  assertEquals(body.kind, "rpc_error")
})

Deno.test("POST /commit returns 502 commit_failed when MCP responds OK but text has no program_id (malformed)", async () => {
  // The MCP server is the source of truth for program_id. If we can't parse
  // one out of the success response, the row may or may not have actually
  // landed — bailing with 502 + status-stays is the safer default than
  // returning a phantom program_id and breaking client navigation.
  const active = PREVIEW_READY_THREAD()
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    callMcp: async () => ({
      ok: true,
      value: { content: [{ type: "text", text: '{"dry_run": false, "message": "?"}' }] },
    }),
  })

  const res = await handleEmbeddedAgent(commitRequest({ confirm: true }), deps)

  assertEquals(res.status, 502)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "commit_failed")
  assertEquals(body.kind, "invalid_response")
  assertEquals(calls.setStatusToCommitted.length, 0)
})

Deno.test("POST /commit returns 401 when the auth header is missing", async () => {
  const { deps, calls } = makeDeps({ getUser: async () => null })

  const res = await handleEmbeddedAgent(
    commitRequest({ confirm: true }, { withAuth: false }),
    deps,
  )

  assertEquals(res.status, 401)
  assertEquals(calls.callMcp.length, 0)
  assertEquals(calls.setStatusToCommitted.length, 0)
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
