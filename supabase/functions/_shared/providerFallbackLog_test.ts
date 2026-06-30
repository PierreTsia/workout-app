import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { makeFallbackLogger } from "./providerFallbackLog.ts"

// #405 — The provider dimension is INFRASTRUCTURE: it may appear in server
// logs but never on the wire (ADR 0009 branding invariant). This logger maps
// withFallback's FallbackLog onto structured console lines and — critically —
// stays quiet on the common primary-success path so logs aren't spammed.

function makeSink() {
  const warns: string[] = []
  const infos: string[] = []
  return {
    warns,
    infos,
    sink: { warn: (s: string) => warns.push(s), info: (s: string) => infos.push(s) },
  }
}

Deno.test("makeFallbackLogger: a fallback event is a structured warn carrying provider + kind", () => {
  const { warns, sink } = makeSink()
  const log = makeFallbackLogger("embedded-agent", sink, () => "2026-06-30T00:00:00.000Z")

  log({ type: "fallback", fromKind: "provider_unavailable", upstreamStatus: 503, from: "gemini", to: "groq" })

  assertEquals(warns.length, 1)
  const payload = JSON.parse(warns[0])
  assertEquals(payload.feature, "embedded-agent")
  assertEquals(payload.type, "fallback")
  assertEquals(payload.from, "gemini")
  assertEquals(payload.to, "groq")
  assertEquals(payload.fromKind, "provider_unavailable")
})

Deno.test("makeFallbackLogger: primary success stays silent (no log spam)", () => {
  const { warns, infos, sink } = makeSink()
  const log = makeFallbackLogger("embedded-agent", sink)

  log({ type: "resolved", provider: "gemini", viaFallback: false })

  assertEquals(warns.length, 0)
  assertEquals(infos.length, 0)
})

Deno.test("makeFallbackLogger: a fallback-served success logs the winning provider", () => {
  const { infos, sink } = makeSink()
  const log = makeFallbackLogger("generate-quick-workout", sink)

  log({ type: "resolved", provider: "groq", viaFallback: true })

  assertEquals(infos.length, 1)
  const payload = JSON.parse(infos[0])
  assertEquals(payload.provider, "groq")
  assert(payload.viaFallback === true)
})
