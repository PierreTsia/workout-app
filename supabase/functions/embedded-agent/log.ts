// Shared structured logging for the embedded-agent Edge function (T122).
// One canonical event shape, one entry point. Routes / handler stay
// agnostic about the sink — they call `deps.log(event)` and the prod
// boundary in `index.ts` wires `emitLog` here.
//
// We deliberately keep `LogEvent.route` typed as a literal union so the
// canonical taxonomy is enforced at compile time. `error_kind` stays a
// string for now (validated by handler tests) — tightening it to a
// per-route discriminated union is a possible follow-up but pays for
// itself only once we have alerting downstream that cares about the
// inventory.

export type LogRoute = "/thread" | "/message" | "/draft" | "/commit" | "/reject"

export interface LogEvent {
  level: "error" | "warn" | "info"
  feature: "embedded-agent"
  route: LogRoute
  // Required for warn/error events. Optional on info boundaries where
  // there is no error to classify (thread_created etc. encode the kind
  // of boundary in `message` instead).
  error_kind?: string
  request_id: string
  user_id?: string
  thread_id?: string
  message?: string
}

/**
 * Emit a single structured log line. The level decides which console
 * sink fires so log queries can filter by stderr/stdout without
 * re-parsing the JSON payload (matches the Phase A proof pattern).
 *
 * Stamps `ts` at emit time so call sites don't have to thread a clock.
 * The whole event is JSON-serialized in one go — no partial lines.
 */
export function emitLog(event: LogEvent): void {
  const payload = JSON.stringify({ ts: new Date().toISOString(), ...event })
  if (event.level === "error") console.error(payload)
  else if (event.level === "warn") console.warn(payload)
  else console.log(payload)
}
