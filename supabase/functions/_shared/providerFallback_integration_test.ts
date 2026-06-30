import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { withFallback, type FallbackLog } from "./withFallback.ts"
import { GEMINI, GROQ } from "./aiProviders.ts"
import { callChatGemini } from "../embedded-agent/chatModel.ts"
import { callChatGroq } from "../embedded-agent/groqChat.ts"
import { callGeminiProgram } from "./programGemini.ts"
import { callGroqProgram } from "./programGroq.ts"
import { callGemini as callQuickWorkoutGemini } from "../generate-quick-workout/gemini.ts"
import { callGroqWorkout } from "../generate-quick-workout/groq.ts"
import type { ChatModelInput } from "../embedded-agent/handler.ts"

// #405 — END-TO-END fallback chain. Unlike the per-module tests, these wire
// the REAL primary adapter + REAL withFallback + REAL secondary adapter — the
// exact composition each `index.ts` builds — and inject only `fetch`. They
// prove the assembled behavior: a Gemini availability failure is served by
// Groq, a Gemini config bug is NOT, and the provider that answered never
// leaks into the returned value (branding invariant — server logs only).

Deno.env.set("GEMINI_API_KEY", "test-gemini-key")

const noopSleep = (): Promise<void> => Promise.resolve()

function gemini503(): Response {
  return new Response(
    JSON.stringify({ error: { code: 503, message: "high demand", status: "UNAVAILABLE" } }),
    { status: 503 },
  )
}

function groqOk(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }),
    { status: 200 },
  )
}

// Sequential fetch stub: hands out queued responses, counting calls.
function makeFetch(responses: Array<Response | Error>) {
  let i = 0
  const state = { calls: 0 }
  const fetchImpl = (() => {
    state.calls += 1
    const next = responses[i++]
    if (next === undefined) return Promise.reject(new Error(`unexpected fetch #${i}`))
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  }) as typeof fetch
  return { fetchImpl, state }
}

const opts = (log?: (e: FallbackLog) => void) => ({
  from: GEMINI.name,
  to: GROQ.name,
  isSecondaryConfigured: () => true,
  log,
})

const chatInput: ChatModelInput = {
  systemPrompt: "you are a coach",
  messages: [{ role: "user", content: "make me a plan", ts: "2026-06-30T00:00:00.000Z" }],
}

Deno.test("E2E chat: Gemini 503 (retry exhausted) → Groq serves the turn; provider stays out of the result", async () => {
  const gemini = makeFetch([gemini503(), gemini503()]) // 2 attempts, both down
  const groq = makeFetch([groqOk("here is your plan")])
  const logs: FallbackLog[] = []

  const chatModel = withFallback(
    (input: ChatModelInput) =>
      callChatGemini(input, { fetchImpl: gemini.fetchImpl, sleepImpl: noopSleep }),
    (input: ChatModelInput) => callChatGroq(input, { apiKey: "k", fetchImpl: groq.fetchImpl }),
    opts((e) => logs.push(e)),
  )

  const out = await chatModel(chatInput)

  assertEquals(out, { content: "here is your plan" })
  assertEquals(gemini.state.calls, 2) // primary retried once in-place, then gave up
  assertEquals(groq.state.calls, 1) // fallback served
  // The provider dimension is in the LOG, never in the returned value.
  assert(!("provider" in out))
  assert(logs.some((e) => e.type === "fallback" && e.fromKind === "provider_unavailable"))
  assert(logs.some((e) => e.type === "resolved" && e.provider === "groq" && e.viaFallback))
})

Deno.test("E2E program-draft: Gemini 503 → Groq returns a valid program", async () => {
  const program = {
    rationale: "upper/lower",
    days: [{ label: "Upper", muscle_focus: "chest", exercise_ids: ["e1"] }],
  }
  const gemini = makeFetch([gemini503()])
  const groq = makeFetch([groqOk(JSON.stringify(program))])

  const callModel = withFallback(
    (prompt: string) => callGeminiProgram(prompt, { fetchImpl: gemini.fetchImpl }),
    (prompt: string) => callGroqProgram(prompt, { apiKey: "k", fetchImpl: groq.fetchImpl }),
    opts(),
  )

  assertEquals(await callModel("draft a program"), program)
  assertEquals(groq.state.calls, 1)
})

Deno.test("E2E quick-workout: Gemini 503 → Groq returns a valid workout", async () => {
  const gemini = makeFetch([gemini503()])
  const groq = makeFetch([groqOk(JSON.stringify({ rationale: "push day", exerciseIds: ["e1", "e2"] }))])

  const callGen = withFallback(
    (prompt: string) => callQuickWorkoutGemini(prompt, { fetchImpl: gemini.fetchImpl }),
    (prompt: string) => callGroqWorkout(prompt, { apiKey: "k", fetchImpl: groq.fetchImpl }),
    opts(),
  )

  assertEquals(await callGen("quick push workout"), {
    rationale: "push day",
    exerciseIds: ["e1", "e2"],
  })
  assertEquals(groq.state.calls, 1)
})

Deno.test("E2E chat: Gemini 400 (our bug) does NOT fall back — Groq is never touched", async () => {
  const gemini = makeFetch([new Response("bad key", { status: 400 })])
  const groq = makeFetch([groqOk("should never run")])

  const chatModel = withFallback(
    (input: ChatModelInput) =>
      callChatGemini(input, { fetchImpl: gemini.fetchImpl, sleepImpl: noopSleep }),
    (input: ChatModelInput) => callChatGroq(input, { apiKey: "k", fetchImpl: groq.fetchImpl }),
    opts(),
  )

  await assertRejects(() => chatModel(chatInput), Error, "Gemini API error 400")
  assertEquals(groq.state.calls, 0) // client_error surfaces, never masked by a fallback
})
