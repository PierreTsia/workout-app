// Structured logging for the commit-quick-workout Edge function (T128, #342).
// Mirrors `generate-quick-workout/log.ts` and `embedded-agent/log.ts` so all
// three Quick Workout / Embedded Agent functions emit the same envelope.

export type LogRoute = "/commit"

export interface LogEvent {
  level: "error" | "warn" | "info"
  feature: "commit-quick-workout"
  route: LogRoute
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
