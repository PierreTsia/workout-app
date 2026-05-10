// Structured logging for the generate-quick-workout Edge function (T127,
// #342). Mirrors `embedded-agent/log.ts` so observability sinks see the same
// envelope: one log line, JSON-serialized, level routed to console
// stderr/stdout. The handler is sink-agnostic — it calls `deps.log(event)`
// and `index.ts` wires `emitLog` here.
//
// Story 17 (Epic Brief): at minimum one error path emits a structured line
// so post-deploy debugging doesn't depend on stack-trace archaeology.

export type LogRoute = "/generate"

export interface LogEvent {
  level: "error" | "warn" | "info"
  feature: "generate-quick-workout"
  route: LogRoute
  /** Required for warn/error events. Optional on info boundaries. */
  error_kind?: string
  request_id: string
  user_id?: string
  message?: string
}

export function emitLog(event: LogEvent): void {
  const payload = JSON.stringify({ ts: new Date().toISOString(), ...event })
  if (event.level === "error") console.error(payload)
  else if (event.level === "warn") console.warn(payload)
  else console.log(payload)
}
