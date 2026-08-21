import { isoDayInTimeZone, priorWindowRange } from "@/lib/profile/windowRange"
import type { ProfileSnapshot, PulseVm, SessionFact } from "@/lib/profile/types"

export function sessionDurationMs(
  session: Pick<SessionFact, "active_duration_ms" | "started_at" | "finished_at">,
): number {
  if (session.active_duration_ms != null && session.active_duration_ms >= 0) {
    return session.active_duration_ms
  }
  return Math.max(
    0,
    new Date(session.finished_at).getTime() - new Date(session.started_at).getTime(),
  )
}

function localFinishedDay(session: SessionFact, timeZone: string): string {
  return isoDayInTimeZone(new Date(session.finished_at), timeZone)
}

function sessionsInRange(
  sessions: readonly SessionFact[],
  from: string,
  to: string,
  timeZone: string,
): SessionFact[] {
  return sessions.filter((session) => {
    const day = localFinishedDay(session, timeZone)
    return day >= from && day <= to
  })
}

function pulseTotals(sessions: readonly SessionFact[]): {
  sessions: number
  durationMs: number
} {
  return {
    sessions: sessions.length,
    durationMs: sessions.reduce((sum, session) => sum + sessionDurationMs(session), 0),
  }
}

export function buildPulseVm(
  snapshot: ProfileSnapshot,
  input: {
    from: string
    to: string
    includeDeltas: boolean
    timeZone: string
    prescribedMinutes: number | null
  },
): PulseVm {
  const current = sessionsInRange(
    snapshot.sessions,
    input.from,
    input.to,
    input.timeZone,
  )
  if (current.length === 0) {
    return { status: "empty" }
  }

  const totals = pulseTotals(current)
  const avgMinutes = Math.round(totals.durationMs / totals.sessions / 60_000)

  if (!input.includeDeltas) {
    return {
      status: "ok",
      sessions: totals.sessions,
      sessionDelta: null,
      durationMs: totals.durationMs,
      durationDeltaMs: null,
      avgMinutes,
      prescribedMinutes: input.prescribedMinutes,
    }
  }

  const prior = priorWindowRange(input.from, input.to)
  const priorTotals = pulseTotals(
    sessionsInRange(snapshot.sessions, prior.from, prior.to, input.timeZone),
  )

  return {
    status: "ok",
    sessions: totals.sessions,
    sessionDelta: totals.sessions - priorTotals.sessions,
    durationMs: totals.durationMs,
    durationDeltaMs: totals.durationMs - priorTotals.durationMs,
    avgMinutes,
    prescribedMinutes: input.prescribedMinutes,
  }
}

export function formatPulseDuration(ms: number): string {
  const totalMin = Math.round(Math.abs(ms) / 60_000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}` : `${h}h`
}
