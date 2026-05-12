import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { handleEmbeddedAgent, type LogEvent } from "./handler.ts"
import type { Thread, ThreadLocale, ThreadMessage, ThreadPurpose } from "./threadStore.ts"
import type { UserContextProfile } from "./prompt/index.ts"
import type { DraftArgs, DraftResult, LastPreview } from "./draft.ts"
import type { CallMcpToolResult } from "../_shared/mcpClient.ts"
import {
  BundleSizeExceeded,
  ProfileMissing,
  type AdditionalProgramBundle,
} from "./lib/bundle.ts"

// ---------- factories ----------

function makeStubBundle(
  overrides: Partial<AdditionalProgramBundle> = {},
): AdditionalProgramBundle {
  return {
    v: 1,
    captured_at: "2026-05-12T12:00:00.000Z",
    profile: {
      goal: "hypertrophy",
      experience: "intermediate",
      equipment: "gym",
      training_days_per_week: 4,
      session_duration_minutes: 60,
      age: 30,
      weight_kg: 75,
      gender: "male",
    },
    active_program: {
      id: "prog-1",
      name: "Push Pull Legs",
      days: [
        { label: "Push", exercise_count: 4, muscle_groups: ["chest", "shoulders", "triceps"] },
        { label: "Pull", exercise_count: 2, muscle_groups: ["back", "biceps"] },
      ],
    },
    recent_stats: {
      window_days: 28,
      total_sessions: 8,
      sessions_per_week: 2,
      top_muscle_groups: ["chest", "back"],
      avg_session_duration_minutes: 55,
    },
    ...overrides,
  }
}

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
    purpose: "onboarding",
    change_motivation: null,
    bundle_context: null,
    validator_rejection_count: 0,
    pending_constraint_overrides: null,
    ...overrides,
  }
}

// ---------- deps factory ----------

interface DepsCalls {
  getUser: Array<{ authHeader: string }>
  getActiveThread: Array<{ userId: string; purpose: ThreadPurpose }>
  getOrCreateActiveThread: Array<{ userId: string; locale: ThreadLocale; purpose: ThreadPurpose }>
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
  purgeRetention: Array<{ userId: string }>
  buildBundle: Array<{ userId: string }>
  setBundle: Array<{ threadId: string; bundle: AdditionalProgramBundle }>
  logEvents: LogEvent[]
}

interface DepsOverrides {
  getUser?: (authHeader: string) => Promise<{ userId: string } | null>
  getActiveThread?: (userId: string, purpose: ThreadPurpose) => Promise<Thread | null>
  getOrCreateActiveThread?: (
    userId: string,
    locale: ThreadLocale,
    purpose: ThreadPurpose,
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
  purgeRetention?: (userId: string) => Promise<void>
  buildBundle?: (userId: string) => Promise<AdditionalProgramBundle>
  setBundle?: (thread: Thread, bundle: AdditionalProgramBundle) => Promise<void>
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
    purgeRetention: [],
    buildBundle: [],
    setBundle: [],
    logEvents: [],
  }

  const deps = {
    getUser: async (authHeader: string) => {
      calls.getUser.push({ authHeader })
      return overrides.getUser
        ? await overrides.getUser(authHeader)
        : { userId: "user-1" }
    },
    getActiveThread: async (userId: string, purpose: ThreadPurpose) => {
      calls.getActiveThread.push({ userId, purpose })
      return overrides.getActiveThread
        ? await overrides.getActiveThread(userId, purpose)
        : null
    },
    getOrCreateActiveThread: async (userId: string, locale: ThreadLocale, purpose: ThreadPurpose) => {
      calls.getOrCreateActiveThread.push({ userId, locale, purpose })
      return overrides.getOrCreateActiveThread
        ? await overrides.getOrCreateActiveThread(userId, locale, purpose)
        : { thread: makeThread({ user_id: userId, locale, purpose }), resumed: false }
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
    purgeRetention: async (userId: string) => {
      calls.purgeRetention.push({ userId })
      if (overrides.purgeRetention) await overrides.purgeRetention(userId)
    },
    buildBundle: async (userId: string) => {
      calls.buildBundle.push({ userId })
      return overrides.buildBundle
        ? await overrides.buildBundle(userId)
        : makeStubBundle()
    },
    setBundle: async (thread: Thread, bundle: AdditionalProgramBundle) => {
      calls.setBundle.push({ threadId: thread.id, bundle })
      if (overrides.setBundle) await overrides.setBundle(thread, bundle)
    },
    log: (event: LogEvent) => {
      calls.logEvents.push(event)
    },
  }

  return { deps, calls }
}

function jsonRequest(
  body: Record<string, unknown>,
  options: { withAuth?: boolean; method?: string; requestId?: string } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  if (options.requestId) headers["x-request-id"] = options.requestId
  const method = options.method ?? "POST"
  // T131 (#343) — default `purpose: 'onboarding'` so pre-T131 fixtures
  // exercise the same flow they did before this epic. Tests that want
  // the back-compat path explicitly omit `purpose`; tests on the
  // additional_program flow override.
  const bodyWithPurpose = "purpose" in body ? body : { purpose: "onboarding", ...body }
  return new Request("https://example.test/thread", {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(bodyWithPurpose),
  })
}

// PR review #3: builder for malformed-body requests so we can exercise the
// `req.json()` parse-failure guard. JSON.stringify-based helper above
// always produces valid JSON; this one does not.
function rawRequest(rawBody: string): Request {
  return new Request("https://example.test/thread", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer jwt_test",
    },
    body: rawBody,
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
  assertEquals(calls.getOrCreateActiveThread[0], {
    userId: "user-1",
    locale: "en",
    purpose: "onboarding",
  })

  // T122: every authenticated request fires the lazy 90d retention sweep.
  assertEquals(calls.purgeRetention.length, 1)
  assertEquals(calls.purgeRetention[0].userId, "user-1")

  // T122 boundary info — exactly one info line per /open response,
  // distinguishing newly-created threads from resumed ones for funnel
  // analysis.
  const infos = calls.logEvents.filter((e) => e.level === "info")
  assertEquals(infos.length, 1)
  assertEquals(infos[0].message, "thread_created")
  assertEquals(infos[0].route, "/thread")
  assertEquals(infos[0].thread_id, "thread-fresh")
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
  assertEquals(calls.logEvents[0].route, "/thread")
  assertEquals(calls.logEvents[0].level, "warn")
  assertEquals(calls.logEvents[0].feature, "embedded-agent")
})

Deno.test("POST /thread with an unsupported locale returns 400 invalid_locale", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "es" }), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_locale")
  assertEquals(calls.getOrCreateActiveThread.length, 0)
  // T122: every error path emits one structured warn line with the
  // canonical kind. The user_id is present here because auth succeeded
  // before the locale guard fired.
  const warns = calls.logEvents.filter((e) => e.level === "warn")
  assertEquals(warns.length, 1)
  assertEquals(warns[0].error_kind, "invalid_locale")
  assertEquals(warns[0].route, "/thread")
  assertEquals(warns[0].user_id, "user-1")
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

// PR review #3: malformed JSON body must produce a structured 400 + warn,
// not a bare 500 from an unguarded `req.json()` throw.
Deno.test("POST /thread with malformed JSON body returns 400 invalid_json + warn log", async () => {
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(rawRequest("{ this is not json"), deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_json")
  assertEquals(calls.getOrCreateActiveThread.length, 0)
  const warns = calls.logEvents.filter((e) => e.level === "warn")
  assertEquals(warns.some((e) => e.error_kind === "invalid_json"), true)
  // The auth check runs before parsing so the user_id is attributable.
  const invalidJsonLog = warns.find((e) => e.error_kind === "invalid_json")
  assertEquals(invalidJsonLog?.user_id, "user-1")
  assertEquals(invalidJsonLog?.route, "/thread")
})

// PR review #5: when the client sends `x-request-id`, every log line on
// the request must carry that id (so browser ↔ edge logs correlate).
// Mirrors the contract honoured by `mcp-phase-a-proof`.
Deno.test("POST /thread propagates x-request-id from the client into structured logs", async () => {
  const { deps, calls } = makeDeps({ getUser: async () => null })
  const requestId = "req-from-browser-123"

  await handleEmbeddedAgent(
    jsonRequest({ action: "open", locale: "en" }, { requestId }),
    deps,
  )

  // The auth_missing log line is emitted before any other code path; if
  // request-id propagation is broken we'd see a fresh UUID instead.
  const authLog = calls.logEvents.find((e) => e.error_kind === "auth_missing")
  assertEquals(authLog?.request_id, requestId)
})

function sendRequest(
  body: { content?: unknown; locale?: unknown; purpose?: unknown },
  options: { withAuth?: boolean } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  // T131 (#343) — default purpose so pre-T131 send tests keep one warn line.
  const bodyWithPurpose = "purpose" in body ? body : { purpose: "onboarding", ...body }
  return new Request("https://example.test/message", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "send", ...bodyWithPurpose }),
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

  // T122: turn_quota_exceeded is logged with the thread_id so a 429
  // spike on a single onboarding session is greppable. Volume is
  // bounded by the quota itself.
  const warns = calls.logEvents.filter((e) => e.level === "warn")
  assertEquals(warns.length, 1)
  assertEquals(warns[0].error_kind, "turn_quota_exceeded")
  assertEquals(warns[0].route, "/message")
  assertEquals(warns[0].thread_id, "t-1")
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
  // Canonical taxonomy (T122 inventory): the log uses `provider_failure`
  // even though the wire contract still says `model_failure` — the web
  // client's error parser depends on the wire string and isn't in scope
  // for this ticket.
  assertEquals(calls.logEvents[0].error_kind, "provider_failure")
  assertEquals(calls.logEvents[0].route, "/message")
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
  body: { trigger?: unknown; locale?: unknown; purpose?: unknown },
  options: { withAuth?: boolean } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.withAuth ?? true) headers["Authorization"] = "Bearer jwt_test"
  // T131 (#343) — default purpose so pre-T131 draft tests keep one warn line.
  const bodyWithPurpose = "purpose" in body ? body : { purpose: "onboarding", ...body }
  return new Request("https://example.test/message", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "draft", ...bodyWithPurpose }),
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
  // T122: canonical /draft kind, gated by the per-user 24h cap.
  const warns = calls.logEvents.filter((e) => e.level === "warn")
  assertEquals(warns.length, 1)
  assertEquals(warns[0].error_kind, "draft_quota_exceeded")
  assertEquals(warns[0].route, "/draft")
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

// PR review #4: an unexpected throw inside `runDraftStep` (catalog/profile
// fetch failure, validation crash, etc.) used to surface as an unstructured
// 500 because the call was wrapped only in try/finally. We now catch it,
// log a canonical `provider_failure` line, return the standard 502 contract,
// AND still credit the billable call (log_everything).
Deno.test("POST /draft maps an unexpected runDraftStep throw to provider_failure 502 + billable log", async () => {
  const active = makeThread({ id: "t-x", status: "open" })
  const { deps, calls } = makeDeps({
    getActiveThread: async () => active,
    runDraftStep: async () => {
      throw new Error("catalog fetch crashed unexpectedly")
    },
  })

  const res = await handleEmbeddedAgent(
    draftRequest({ trigger: "user_cta", locale: "en" }),
    deps,
  )

  assertEquals(res.status, 502)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "draft_failed")
  assertEquals(body.reason, "internal")
  assertEquals(calls.logBillableCall.length, 1)
  assertEquals(calls.setStatusToPreviewReady.length, 0)
  // One canonical error log line with the right kind/route.
  const errors = calls.logEvents.filter((e) => e.level === "error")
  const providerFailure = errors.find((e) => e.error_kind === "provider_failure")
  assertEquals(providerFailure?.route, "/draft")
  assertEquals(providerFailure?.thread_id, "t-x")
  assertEquals(typeof providerFailure?.message === "string", true)
  assertEquals(
    (providerFailure?.message as string).includes("catalog fetch crashed unexpectedly"),
    true,
  )
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
  // T131 (#343) — default purpose so pre-T131 commit tests keep one warn line.
  const bodyWithPurpose = "purpose" in body ? body : { purpose: "onboarding", ...body }
  return new Request("https://example.test/commit", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "commit", ...bodyWithPurpose }),
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
  // T122: canonical /commit kind. Wire still says `invalid_confirm` for
  // back-compat with the web client; the log uses the canonical name.
  const warns = calls.logEvents.filter((e) => e.level === "warn")
  assertEquals(warns.length, 1)
  assertEquals(warns[0].error_kind, "confirm_required")
  assertEquals(warns[0].route, "/commit")
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

// ─────────────────────────────────────────────────────────────────────────────
// Purpose dispatch (T131, #343)
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("POST { action: open, purpose: 'additional_program' } scopes the thread lookup by purpose", async () => {
  // T131 (#343) — purpose plumbs from the request body through to the
  // threadStore deps so the (user_id, purpose) unique index is honored.
  const { deps, calls } = makeDeps()

  const res = await handleEmbeddedAgent(
    jsonRequest({ action: "open", locale: "en", purpose: "additional_program" }),
    deps,
  )

  assertEquals(res.status, 200)
  assertEquals(calls.getOrCreateActiveThread.length, 1)
  assertEquals(calls.getOrCreateActiveThread[0], {
    userId: "user-1",
    locale: "en",
    purpose: "additional_program",
  })
  // No back-compat warn when purpose is explicit.
  const warns = calls.logEvents.filter((e) => e.error_kind === "missing_purpose_default_applied")
  assertEquals(warns.length, 0)
})

Deno.test("POST without `purpose` defaults to 'onboarding' AND emits a warn log (back-compat for stale tabs)", async () => {
  // T131 (#343) — pre-T131 clients send no `purpose` field; we default to
  // 'onboarding' so they keep working, but emit a single warn log so
  // observability picks up "your users are running stale code".
  const { deps, calls } = makeDeps()

  // Hand-rolled request that bypasses jsonRequest's purpose default.
  const req = new Request("https://example.test/thread", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer jwt_test",
    },
    body: JSON.stringify({ action: "open", locale: "en" }),
  })

  const res = await handleEmbeddedAgent(req, deps)

  assertEquals(res.status, 200)
  assertEquals(calls.getOrCreateActiveThread[0]?.purpose, "onboarding")
  const warns = calls.logEvents.filter((e) =>
    e.error_kind === "missing_purpose_default_applied"
  )
  assertEquals(warns.length, 1)
  assertEquals(warns[0].purpose, "onboarding")
})

Deno.test("POST with an unknown `purpose` returns 400 invalid_purpose and never dispatches", async () => {
  // T131 (#343) — invalid purpose 400s up front rather than poisoning
  // downstream dispatch with an unchecked string.
  const { deps, calls } = makeDeps()

  const req = new Request("https://example.test/thread", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer jwt_test",
    },
    body: JSON.stringify({ action: "open", locale: "en", purpose: "weight_loss_plan" }),
  })

  const res = await handleEmbeddedAgent(req, deps)

  assertEquals(res.status, 400)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "invalid_purpose")
  assertEquals(calls.getOrCreateActiveThread.length, 0)
  const warns = calls.logEvents.filter((e) => e.error_kind === "invalid_purpose")
  assertEquals(warns.length, 1)
})

// ============================================================================
// T133 (#343) — bundle wiring on /open for additional_program
// ============================================================================

function openAdditionalProgramRequest(): Request {
  return jsonRequest({
    action: "open",
    locale: "en",
    purpose: "additional_program",
  })
}

Deno.test("POST /thread { open, additional_program } (fresh) builds + persists bundle and returns bundle_summary", async () => {
  const fresh = makeThread({
    id: "thread-ap-fresh",
    user_id: "user-1",
    purpose: "additional_program",
    bundle_context: null,
  })
  const { deps, calls } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: fresh, resumed: false }),
  })

  const res = await handleEmbeddedAgent(openAdditionalProgramRequest(), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.thread_id, "thread-ap-fresh")

  // Bundle was built + persisted exactly once.
  assertEquals(calls.buildBundle.length, 1)
  assertEquals(calls.buildBundle[0].userId, "user-1")
  assertEquals(calls.setBundle.length, 1)
  assertEquals(calls.setBundle[0].threadId, "thread-ap-fresh")
  assertEquals(calls.setBundle[0].bundle.v, 1)

  // Response carries the compact summary so the UI can render the
  // "we're building on top of X" chip without a second roundtrip.
  assertEquals(body.bundle_summary, {
    active_program_name: "Push Pull Legs",
    sessions_per_week: 2,
    top_muscle_group: "chest",
  })

  // Purpose is plumbed through every action handler's log line.
  const info = calls.logEvents.find((e) => e.level === "info" && e.route === "/thread")
  assertEquals(info?.purpose, "additional_program")
  assertEquals(info?.message, "thread_created")
})

Deno.test("POST /thread { open, additional_program } (resumed with bundle present) does NOT rebuild", async () => {
  const existingBundle = makeStubBundle({
    active_program: {
      id: "prog-existing",
      name: "Existing Program",
      days: [{ label: "Day 1", exercise_count: 3, muscle_groups: ["chest"] }],
    },
  })
  const resumed = makeThread({
    id: "thread-ap-resumed",
    user_id: "user-1",
    purpose: "additional_program",
    bundle_context: existingBundle as unknown as Record<string, unknown>,
  })
  const { deps, calls } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: resumed, resumed: true }),
  })

  const res = await handleEmbeddedAgent(openAdditionalProgramRequest(), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>

  // Resumed threads with an existing bundle never re-trigger the builder.
  assertEquals(calls.buildBundle.length, 0)
  assertEquals(calls.setBundle.length, 0)

  // Summary is projected from the persisted snapshot.
  assertEquals(body.bundle_summary, {
    active_program_name: "Existing Program",
    sessions_per_week: 2,
    top_muscle_group: "chest",
  })
})

Deno.test("POST /thread { open, onboarding } does NOT touch the bundle builder (regression)", async () => {
  const fresh = makeThread({ id: "thread-onb", purpose: "onboarding", bundle_context: null })
  const { deps, calls } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: fresh, resumed: false }),
  })

  const res = await handleEmbeddedAgent(jsonRequest({ action: "open", locale: "en" }), deps)

  assertEquals(res.status, 200)
  const body = await res.json() as Record<string, unknown>

  // Bundle deps untouched on the onboarding path.
  assertEquals(calls.buildBundle.length, 0)
  assertEquals(calls.setBundle.length, 0)
  // Response shape stays clean for onboarding — `bundle_summary` only
  // appears for additional_program (avoids polluting the funnel).
  assertEquals("bundle_summary" in body, false)
})

Deno.test("POST /thread { open, additional_program } returns 409 profile_missing when ProfileMissing is thrown", async () => {
  const fresh = makeThread({
    id: "thread-ap-no-profile",
    purpose: "additional_program",
    bundle_context: null,
  })
  const { deps, calls } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: fresh, resumed: false }),
    buildBundle: async () => {
      throw new ProfileMissing()
    },
  })

  const res = await handleEmbeddedAgent(openAdditionalProgramRequest(), deps)

  assertEquals(res.status, 409)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "profile_missing")

  // Builder ran, persist never happened (no bundle to write).
  assertEquals(calls.buildBundle.length, 1)
  assertEquals(calls.setBundle.length, 0)

  // Structured warn on the failure path.
  const warns = calls.logEvents.filter((e) => e.error_kind === "profile_missing")
  assertEquals(warns.length, 1)
  assertEquals(warns[0].route, "/thread")
  assertEquals(warns[0].purpose, "additional_program")
})

Deno.test("POST /thread { open, additional_program } returns 500 internal + error log when BundleSizeExceeded is thrown", async () => {
  const fresh = makeThread({
    id: "thread-ap-oversize",
    purpose: "additional_program",
    bundle_context: null,
  })
  const { deps, calls } = makeDeps({
    getOrCreateActiveThread: async () => ({ thread: fresh, resumed: false }),
    buildBundle: async () => {
      throw new BundleSizeExceeded(9000)
    },
  })

  const res = await handleEmbeddedAgent(openAdditionalProgramRequest(), deps)

  assertEquals(res.status, 500)
  const body = await res.json() as Record<string, unknown>
  assertEquals(body.error, "internal")

  // Persist never runs for a builder failure.
  assertEquals(calls.setBundle.length, 0)

  // Builder-bug → structured *error* level (vs warn for the user-facing
  // 409 path above).
  const errors = calls.logEvents.filter((e) => e.level === "error")
  assertEquals(errors.length, 1)
  assertEquals(errors[0].error_kind, "internal")
  assertEquals(errors[0].route, "/thread")
  assertEquals(errors[0].purpose, "additional_program")
})
