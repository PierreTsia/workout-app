import { formatSessionDayKeyInTimeZone } from "@/lib/sessionDayInTimeZone"
import type { Session } from "@/types/database"

/**
 * Sessions to show for a selected day.
 *
 * An unfinished session (#568) is bucketed on its last known instant —
 * `finished_at` once closed, otherwise `started_at` — so a session whose close
 * never landed still shows up instead of disappearing from History.
 */
export function sessionsForDay(
  sessions: Session[],
  selectedKey: string,
  timeZone: string,
): Session[] {
  return sessions.filter((s) => {
    const instant = s.finished_at ?? s.started_at
    return (
      instant != null &&
      formatSessionDayKeyInTimeZone(instant, timeZone) === selectedKey
    )
  })
}
