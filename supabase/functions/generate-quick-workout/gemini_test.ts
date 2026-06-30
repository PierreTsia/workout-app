import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { callGemini } from "./gemini.ts"
import { ProviderError } from "../_shared/providerError.ts"

// #405 — the quick-workout Gemini adapter must throw the shared
// `ProviderError` so `withFallback` classifies it (4xx never falls back, 5xx
// does). Uses the `fetchImpl` DI seam added with this change.

Deno.env.set("GEMINI_API_KEY", "test-key")

function geminiJson(payload: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

Deno.test("callGemini (quick-workout): 503 throws ProviderError(provider_unavailable, 503)", async () => {
  const fetchImpl = (() => Promise.resolve(new Response("busy", { status: 503 }))) as typeof fetch

  const err = await assertRejects(() => callGemini("p", { fetchImpl }))

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "provider_unavailable")
  assertEquals(err.upstreamStatus, 503)
})

Deno.test("callGemini (quick-workout): 400 throws ProviderError(client_error)", async () => {
  const fetchImpl = (() => Promise.resolve(new Response("bad", { status: 400 }))) as typeof fetch

  const err = await assertRejects(() => callGemini("p", { fetchImpl }))

  assertInstanceOf(err, ProviderError)
  assertEquals(err.kind, "client_error")
})

Deno.test("callGemini (quick-workout): 200 valid JSON returns trimmed shape", async () => {
  const fetchImpl = (() =>
    Promise.resolve(geminiJson({ rationale: "  go  ", exerciseIds: ["e1"] }))) as typeof fetch

  const out = await callGemini("p", { fetchImpl })

  assertEquals(out, { rationale: "go", exerciseIds: ["e1"] })
})
