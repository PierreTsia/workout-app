import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { withFallback } from "./withFallback.ts"
import { ProviderError } from "./providerError.ts"

// #405 — Generic primary→fallback HOF. Tests pin orchestration behavior
// (who runs, who doesn't, which error surfaces, what gets logged) through
// the wrapped function's public call signature — never the internals.

// A minimal logger spy: collects the structured events withFallback emits so
// tests assert on the observable log stream the seam will forward to emitLog.
function makeLogSpy() {
  const events: unknown[] = []
  return { events, log: (e: unknown) => events.push(e) }
}

Deno.test("withFallback: primary succeeds → returns primary result, secondary never runs", async () => {
  let secondaryCalls = 0
  const wrapped = withFallback(
    (input: string) => Promise.resolve(`primary:${input}`),
    (input: string) => {
      secondaryCalls++
      return Promise.resolve(`secondary:${input}`)
    },
    { from: "gemini", to: "groq" },
  )

  const result = await wrapped("hello")

  assertEquals(result, "primary:hello")
  assertEquals(secondaryCalls, 0)
})

Deno.test("withFallback: primary 503 → secondary runs with the same input and wins", async () => {
  const wrapped = withFallback(
    () =>
      Promise.reject(new ProviderError("provider_unavailable", "high demand", 503)),
    (input: string) => Promise.resolve(`secondary:${input}`),
    { from: "gemini", to: "groq" },
  )

  const result = await wrapped("hello")

  assertEquals(result, "secondary:hello")
})

Deno.test("withFallback: primary client_error (4xx) → no fallback, primary error surfaces", async () => {
  let secondaryCalls = 0
  const primaryErr = new ProviderError("client_error", "bad api key", 401)
  const wrapped = withFallback(
    () => Promise.reject(primaryErr),
    (input: string) => {
      secondaryCalls++
      return Promise.resolve(`secondary:${input}`)
    },
    { from: "gemini", to: "groq" },
  )

  const thrown = await assertRejects(() => wrapped("hello"))

  assert(thrown === primaryErr, "the original primary error must surface unchanged")
  assertEquals(secondaryCalls, 0)
})

Deno.test("withFallback: secondary misconfigured → primary error surfaces, not masked", async () => {
  let secondaryCalls = 0
  const primaryErr = new ProviderError("provider_unavailable", "high demand", 503)
  const spy = makeLogSpy()
  const wrapped = withFallback(
    () => Promise.reject(primaryErr),
    (input: string) => {
      secondaryCalls++
      return Promise.resolve(`secondary:${input}`)
    },
    { from: "gemini", to: "groq", isSecondaryConfigured: () => false, log: spy.log },
  )

  const thrown = await assertRejects(() => wrapped("hello"))

  assert(thrown === primaryErr, "primary error must surface, not a secondary config error")
  assertEquals(secondaryCalls, 0)
  assertEquals(spy.events, [
    { type: "fallback_unavailable", fromKind: "provider_unavailable", from: "gemini" },
  ])
})

Deno.test("withFallback: both providers down → secondary's error surfaces, after a fallback log", async () => {
  const secondaryErr = new ProviderError("provider_unavailable", "groq busy", 503)
  const spy = makeLogSpy()
  const wrapped = withFallback(
    () =>
      Promise.reject(new ProviderError("provider_unavailable", "gemini busy", 503)),
    () => Promise.reject(secondaryErr),
    { from: "gemini", to: "groq", log: spy.log },
  )

  const thrown = await assertRejects(() => wrapped("hello"))

  assert(thrown === secondaryErr, "the secondary's (most recent) error must surface")
  assertEquals(spy.events, [
    {
      type: "fallback",
      fromKind: "provider_unavailable",
      upstreamStatus: 503,
      from: "gemini",
      to: "groq",
    },
  ])
})

Deno.test("withFallback: a throwing log sink never breaks resolution (best-effort logging)", async () => {
  const throwingLog = () => {
    throw new Error("sink blew up")
  }

  // Primary-success path: the resolved log throws, the result must still come back.
  const onPrimary = withFallback(
    (input: string) => Promise.resolve(`primary:${input}`),
    (input: string) => Promise.resolve(`secondary:${input}`),
    { from: "gemini", to: "groq", log: throwingLog },
  )
  assertEquals(await onPrimary("hi"), "primary:hi")

  // Fallback path: both the fallback log and the resolved log throw.
  const onFallback = withFallback(
    () => Promise.reject(new ProviderError("provider_unavailable", "down", 503)),
    (input: string) => Promise.resolve(`secondary:${input}`),
    { from: "gemini", to: "groq", log: throwingLog },
  )
  assertEquals(await onFallback("hi"), "secondary:hi")
})

Deno.test("withFallback: successful fallback logs fallback then resolved(viaFallback)", async () => {
  const spy = makeLogSpy()
  const wrapped = withFallback(
    () => Promise.reject(new ProviderError("timeout", "budget elapsed")),
    (input: string) => Promise.resolve(`secondary:${input}`),
    { from: "gemini", to: "groq", log: spy.log },
  )

  await wrapped("hi")

  assertEquals(spy.events, [
    { type: "fallback", fromKind: "timeout", upstreamStatus: undefined, from: "gemini", to: "groq" },
    { type: "resolved", provider: "groq", viaFallback: true },
  ])
})
