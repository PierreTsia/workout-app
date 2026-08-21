import { isoDayInTimeZone } from "@/lib/profile/windowRange"
import type { SessionFact } from "@/lib/profile/types"

function inWindow(
  session: SessionFact,
  window: { from: string; to: string; timeZone: string },
): boolean {
  const day = isoDayInTimeZone(new Date(session.finished_at), window.timeZone)
  return day >= window.from && day <= window.to
}

export function hopOtherProgramIdFromIds(
  programIds: readonly (string | null)[],
  activeProgramId: string | null,
): string | null {
  const ids = [
    ...new Set(programIds.filter((id): id is string => id != null)),
  ]
  if (ids.length < 2) return null
  return ids.find((id) => id !== activeProgramId) ?? ids[1] ?? null
}

export function hopOtherProgramId(
  sessions: readonly SessionFact[],
  window: { from: string; to: string; timeZone: string },
  activeProgramId: string | null,
): string | null {
  return hopOtherProgramIdFromIds(
    sessions
      .filter((session) => inWindow(session, window))
      .map((session) => session.program_id),
    activeProgramId,
  )
}
