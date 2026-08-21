import { isoDayInTimeZone } from "@/lib/profile/windowRange"
import type { ProfileSnapshot, SessionFact } from "@/lib/profile/types"

export type PrPair = {
  sessionId: string
  exerciseId: string
  finishedAt: string
  day: string
}

function localFinishedDay(session: SessionFact, timeZone: string): string {
  return isoDayInTimeZone(new Date(session.finished_at), timeZone)
}

export function prPairs(
  snapshot: ProfileSnapshot,
  input: { from: string; to: string; timeZone: string },
): PrPair[] {
  const sessionsById = new Map(snapshot.sessions.map((session) => [session.id, session]))
  const keyed = snapshot.sets
    .filter((set) => set.was_pr)
    .flatMap((set) => {
      const session = sessionsById.get(set.session_id)
      if (session == null) return []
      const day = localFinishedDay(session, input.timeZone)
      if (day < input.from || day > input.to) return []
      return [
        {
          sessionId: set.session_id,
          exerciseId: set.exercise_id,
          finishedAt: session.finished_at,
          day,
        } satisfies PrPair,
      ]
    })

  return [...new Map(keyed.map((pair) => [`${pair.sessionId}:${pair.exerciseId}`, pair])).values()]
}
