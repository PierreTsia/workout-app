import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  classifyProviderError,
  FALLBACK_KINDS,
  httpStatusToFailureKind,
  ProviderError,
  RETRYABLE_STATUSES,
} from "./providerError.ts"

// #405 — provider-agnostic failure taxonomy lifted out of
// embedded-agent/chatModel.ts so withFallback can classify all three AI
// call shapes uniformly. Tests pin the mapping that drives the
// fallback/no-fallback decision.

Deno.test("httpStatusToFailureKind: 503 is provider_unavailable (the observed prod case)", () => {
  assertEquals(httpStatusToFailureKind(503), "provider_unavailable")
})

Deno.test("httpStatusToFailureKind: other 5xx are provider_error", () => {
  assertEquals(httpStatusToFailureKind(500), "provider_error")
  assertEquals(httpStatusToFailureKind(502), "provider_error")
  assertEquals(httpStatusToFailureKind(504), "provider_error")
})

Deno.test("httpStatusToFailureKind: 4xx (incl. 429) is client_error — our bug, never a fallback", () => {
  assertEquals(httpStatusToFailureKind(400), "client_error")
  assertEquals(httpStatusToFailureKind(401), "client_error")
  assertEquals(httpStatusToFailureKind(429), "client_error")
})

Deno.test("classifyProviderError: a ProviderError round-trips its kind + upstreamStatus", () => {
  const err = new ProviderError("provider_unavailable", "high demand", 503)
  assertEquals(classifyProviderError(err), {
    kind: "provider_unavailable",
    upstreamStatus: 503,
  })
})

Deno.test("classifyProviderError: an AbortError is a timeout (shared budget fired)", () => {
  const abort = new DOMException("aborted", "AbortError")
  assertEquals(classifyProviderError(abort), { kind: "timeout" })
})

Deno.test("classifyProviderError: anything unclassified is provider_error", () => {
  assertEquals(classifyProviderError(new Error("boom")), { kind: "provider_error" })
  assertEquals(classifyProviderError("weird string"), { kind: "provider_error" })
})

Deno.test("FALLBACK_KINDS: availability failures fall back, our-bug / empty do not", () => {
  assertEquals(FALLBACK_KINDS.has("provider_unavailable"), true)
  assertEquals(FALLBACK_KINDS.has("provider_error"), true)
  assertEquals(FALLBACK_KINDS.has("timeout"), true)
  assertEquals(FALLBACK_KINDS.has("client_error"), false)
  assertEquals(FALLBACK_KINDS.has("empty_response"), false)
})

Deno.test("RETRYABLE_STATUSES: exactly the four upstream 5xx we retry in-place", () => {
  assertEquals([...RETRYABLE_STATUSES].sort((a, b) => a - b), [500, 502, 503, 504])
})
