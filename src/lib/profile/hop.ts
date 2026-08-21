import { isoDayInTimeZone } from "@/lib/profile/windowRange"
import type { SessionFact } from "@/lib/profile/types"

function inWindow(
  session: SessionFact,
  window: { from: string; to: string; timeZone: string },
): boolean {
  const day = isoDayInTimeZone(new Date(session.finished_at), window.timeZone)
  return day >= window.from && day <= window.to
}

export function hopOtherProgramId(
  sessions: readonly SessionFact[],
  window: { from: string; to: string; timeZone: string },
  activeProgramId: string | null,
): string | null {
  const ids = [
    ...new Set(
      sessions
        .filter((session) => inWindow(session, window))
        .map((session) => session.program_id)
        .filter((id): id is string => id != null),
    ),
  ]
  if (ids.length < 2) return null
  return ids.find((id) => id !== activeProgramId) ?? ids[1] ?? null
}
