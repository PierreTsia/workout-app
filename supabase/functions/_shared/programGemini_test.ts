import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { callGeminiProgram } from "./programGemini.ts"
import { ProviderError } from "./providerError.ts"

// #405 — the program Gemini adapter must throw the shared `ProviderError`
// (not a bare Error) so `withFallback` classifies it: a 4xx is OUR bug and
// must NOT trigger a fallback, a 5xx must. Tests use the `fetchImpl` DI seam
// (added with this change) so no real Gemini call is made.

Deno.env.set("GEMINI_API_KEY", "test-key")

function geminiJson(payload: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

const VALID = {
  rationale: "split",
  days: [{ label: "A", muscle_focus: "chest", exercise_ids: ["e1"] }],
}

Deno.test("callGeminiProgram: 503 throws ProviderError(provider_unavailable, 503)", async () => {
  const fetchImpl = (() => Promise.resolve(new Response("busy", { status: 503 }))) as typeof fetch

  const err = await assertRejects(() => callGeminiProgram("p", { fetchImpl }))

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "provider_unavailable")
  assertEquals(err.upstreamStatus, 503)
})

Deno.test("callGeminiProgram: 400 throws ProviderError(client_error) — never falls back", async () => {
  const fetchImpl = (() => Promise.resolve(new Response("bad", { status: 400 }))) as typeof fetch

  const err = await assertRejects(() => callGeminiProgram("p", { fetchImpl }))

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "client_error")
})

Deno.test("callGeminiProgram: 200 with valid JSON returns the parsed program", async () => {
  const fetchImpl = (() => Promise.resolve(geminiJson(VALID))) as typeof fetch

  const program = await callGeminiProgram("p", { fetchImpl })

  assertEquals(program, VALID)
})
