// #405 — Bridges withFallback's sink-agnostic `FallbackLog` to a structured
// console line at the edge seam. Lives outside `withFallback` so the HOF stays
// decoupled from any concrete sink, and outside each function's `LogEvent`
// (which is keyed by route/request_id we don't have at wiring time).
//
// Branding invariant (ADR 0009): the provider dimension only ever reaches a
// server log here — never the wire response — so it can't leak to the UI.

import type { FallbackLog } from "./withFallback.ts"

interface LogSink {
  warn: (line: string) => void
  info: (line: string) => void
}

export function makeFallbackLogger(
  feature: string,
  sink: LogSink = console,
  now: () => string = () => new Date().toISOString(),
): (event: FallbackLog) => void {
  return (event) => {
    // The common path — primary answered first try — is a non-event. Logging
    // it would bury the actual fallbacks in noise.
    if (event.type === "resolved" && !event.viaFallback) return

    const line = JSON.stringify({ ts: now(), feature, log: "provider_fallback", ...event })
    if (event.type === "resolved") sink.info(line)
    else sink.warn(line)
  }
}
