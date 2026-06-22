import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  callChatGemini,
  ChatModelError,
  MAX_CHAT_MODEL_ATTEMPTS,
  RETRYABLE_CHAT_MODEL_STATUSES,
} from "./chatModel.ts"
import type { ChatModelInput } from "./handler.ts"

// #358 — Retry on Gemini 5xx. Tests pin the public surface (retry budget,
// status filter, abort behaviour) without coupling to the exact backoff
// schedule — the sleep impl is injected so tests stay deterministic and
// fast.

// ---------- helpers ----------

// Set the API key once so the env guard short-circuit doesn't trip during
// tests. The fetch impl is stubbed below, so no real Gemini call is made.
Deno.env.set("GEMINI_API_KEY", "test-key")

function makeGeminiOkResponse(text = "ok"): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

function makeGeminiErrorResponse(status: number, message = "upstream"): Response {
  return new Response(
    JSON.stringify({ error: { code: status, message, status: "UNAVAILABLE" } }),
    { status, headers: { "Content-Type": "application/json" } },
  )
}

function makeInput(overrides: Partial<ChatModelInput> = {}): ChatModelInput {
  return {
    systemPrompt: "you are a helpful assistant",
    messages: [{ role: "user", content: "hi", ts: "2026-05-20T13:00:00.000Z" }],
    ...overrides,
  }
}

interface FetchRecorder {
  fetchImpl: typeof fetch
  calls: number
}

function makeFetch(responses: Array<Response | Error>): FetchRecorder {
  let i = 0
  const recorder: FetchRecorder = {
    calls: 0,
    fetchImpl: () => {
      recorder.calls += 1
      const next = responses[i++]
      if (next === undefined) {
        return Promise.reject(new Error(`fetch called more times than expected (${i})`))
      }
      if (next instanceof Error) return Promise.reject(next)
      return Promise.resolve(next)
    },
  }
  return recorder
}

function noopSleep(): Promise<void> {
  return Promise.resolve()
}

// ---------- tests ----------

Deno.test("callChatGemini — invariants are sane", () => {
  // Guard the test contract: AC fixes 3 attempts max, retry on 500/502/503/504.
  assertEquals(MAX_CHAT_MODEL_ATTEMPTS, 3)
  assertEquals(
    [...RETRYABLE_CHAT_MODEL_STATUSES].sort((a, b) => a - b),
    [500, 502, 503, 504],
  )
})

Deno.test("callChatGemini — 503 then 200 succeeds and reports one retry", async () => {
  const { fetchImpl } = makeFetch([
    makeGeminiErrorResponse(503),
    makeGeminiOkResponse("hello world"),
  ])

  const retries: Array<{ attempt: number; upstreamStatus: number }> = []
  const out = await callChatGemini(
    makeInput({ onRetry: (info) => retries.push(info) }),
    { fetchImpl, sleepImpl: noopSleep },
  )

  assertEquals(out.content, "hello world")
  assertEquals(retries.length, 1)
  assertEquals(retries[0], { attempt: 1, upstreamStatus: 503 })
})

Deno.test("callChatGemini — three 503s exhaust the retry budget and throw", async () => {
  const recorder = makeFetch([
    makeGeminiErrorResponse(503),
    makeGeminiErrorResponse(503),
    makeGeminiErrorResponse(503),
  ])

  const retries: Array<{ attempt: number; upstreamStatus: number }> = []
  await assertRejects(
    () =>
      callChatGemini(
        makeInput({ onRetry: (info) => retries.push(info) }),
        { fetchImpl: recorder.fetchImpl, sleepImpl: noopSleep },
      ),
    Error,
    "Gemini API error 503",
  )

  assertEquals(recorder.calls, 3)
  // onRetry only fires when we are GOING to retry — last attempt's failure
  // does not signal a retry.
  assertEquals(retries.length, 2)
  assertEquals(retries[0], { attempt: 1, upstreamStatus: 503 })
  assertEquals(retries[1], { attempt: 2, upstreamStatus: 503 })
})

Deno.test("callChatGemini — 400 is NOT retried", async () => {
  const recorder = makeFetch([
    makeGeminiErrorResponse(400, "bad request"),
  ])

  const retries: Array<{ attempt: number; upstreamStatus: number }> = []
  await assertRejects(
    () =>
      callChatGemini(
        makeInput({ onRetry: (info) => retries.push(info) }),
        { fetchImpl: recorder.fetchImpl, sleepImpl: noopSleep },
      ),
    Error,
    "Gemini API error 400",
  )

  assertEquals(recorder.calls, 1)
  assertEquals(retries.length, 0)
})

Deno.test("callChatGemini — AbortError from the shared signal is NOT retried", async () => {
  const recorder = makeFetch([
    Object.assign(new Error("aborted"), { name: "AbortError" }),
  ])

  const retries: Array<{ attempt: number; upstreamStatus: number }> = []
  await assertRejects(
    () =>
      callChatGemini(
        makeInput({ onRetry: (info) => retries.push(info) }),
        { fetchImpl: recorder.fetchImpl, sleepImpl: noopSleep },
      ),
  )

  assertEquals(recorder.calls, 1)
  assertEquals(retries.length, 0)
})

Deno.test("callChatGemini — abort during backoff sleep terminates the retry loop", async () => {
  // PR review (Copilot): the 15s budget covers ALL attempts including the
  // backoff sleeps between them. If the timeout fires mid-sleep the loop
  // must bail immediately instead of finishing the nap and burning another
  // fetch on a doomed signal.
  const recorder = makeFetch([
    makeGeminiErrorResponse(503),
    // The second response is never reached: abort fires inside the sleep
    // and the race rejects before the loop reaches another fetch.
    makeGeminiOkResponse("never"),
  ])

  let capturedController: AbortController | null = null
  // The sleep aborts the shared controller *synchronously*, then returns
  // a promise that never resolves. The signal-aware race must rescue us:
  // if it doesn't, this test will hang and fail by timeout.
  const sleepImpl = (): Promise<void> => {
    capturedController?.abort()
    return new Promise(() => {})
  }

  await assertRejects(
    () =>
      callChatGemini(makeInput(), {
        fetchImpl: recorder.fetchImpl,
        sleepImpl,
        exposeController: (c) => {
          capturedController = c
        },
      }),
    DOMException,
    "Aborted",
  )

  assertEquals(recorder.calls, 1)
})

// #295 — the thrown error must carry a typed `kind` + `upstreamStatus` so
// the handler can name the real cause downstream. These pin the mapping
// (503 → provider_unavailable, 4xx → client_error, empty body →
// empty_response) without re-testing the retry mechanics above.
Deno.test("callChatGemini — exhausted 503 throws ChatModelError(provider_unavailable, 503)", async () => {
  const { fetchImpl } = makeFetch([
    makeGeminiErrorResponse(503),
    makeGeminiErrorResponse(503),
    makeGeminiErrorResponse(503),
  ])

  const err = await assertRejects(
    () => callChatGemini(makeInput(), { fetchImpl, sleepImpl: noopSleep }),
  )

  assertInstanceOf(err, ChatModelError)
  assertEquals(err.kind, "provider_unavailable")
  assertEquals(err.upstreamStatus, 503)
  assertStringIncludes(err.message, "Gemini API error 503")
})

Deno.test("callChatGemini — 400 throws ChatModelError(client_error, 400)", async () => {
  const { fetchImpl } = makeFetch([makeGeminiErrorResponse(400, "bad request")])

  const err = await assertRejects(
    () => callChatGemini(makeInput(), { fetchImpl, sleepImpl: noopSleep }),
  )

  assertInstanceOf(err, ChatModelError)
  assertEquals(err.kind, "client_error")
  assertEquals(err.upstreamStatus, 400)
})

// #318 PR review (Copilot) — a NON-retryable 5xx (501/505/…) is still an
// upstream problem, so it must classify as provider_error, never the
// client_error bucket reserved for 4xx. Guards `httpStatusToFailureKind`.
Deno.test("callChatGemini — non-retryable 5xx (501) throws ChatModelError(provider_error, 501)", async () => {
  const { fetchImpl } = makeFetch([makeGeminiErrorResponse(501, "not implemented")])

  const err = await assertRejects(
    () => callChatGemini(makeInput(), { fetchImpl, sleepImpl: noopSleep }),
  )

  assertInstanceOf(err, ChatModelError)
  assertEquals(err.kind, "provider_error")
  assertEquals(err.upstreamStatus, 501)
})

Deno.test("callChatGemini — 2xx with no usable text throws ChatModelError(empty_response)", async () => {
  // 200 OK but `candidates` is empty → parseSuccess throws → we classify it
  // as empty_response (Gemini answered garbage, distinct from being down).
  const emptyOk = new Response(JSON.stringify({ candidates: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
  const { fetchImpl } = makeFetch([emptyOk])

  const err = await assertRejects(
    () => callChatGemini(makeInput(), { fetchImpl, sleepImpl: noopSleep }),
  )

  assertInstanceOf(err, ChatModelError)
  assertEquals(err.kind, "empty_response")
  assert(err.upstreamStatus === 200)
})

Deno.test("callChatGemini — 429 is NOT retried (quota class, not capacity)", async () => {
  // Sanity guard on the status filter: 429 looks like a 5xx-sibling but
  // it's a deterministic quota signal. Retrying it just burns budget.
  const recorder = makeFetch([makeGeminiErrorResponse(429, "quota")])

  const retries: Array<{ attempt: number; upstreamStatus: number }> = []
  await assertRejects(
    () =>
      callChatGemini(
        makeInput({ onRetry: (info) => retries.push(info) }),
        { fetchImpl: recorder.fetchImpl, sleepImpl: noopSleep },
      ),
    Error,
    "Gemini API error 429",
  )

  assertEquals(recorder.calls, 1)
  assertEquals(retries.length, 0)
})
