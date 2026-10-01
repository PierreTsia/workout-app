import { useCallback, useState } from "react"
import { computeOrphanClose } from "@/lib/orphanSessionClose"
import {
  findBlockingOpenSession,
  type OpenSessionRow,
} from "@/lib/openSessions"
import { trackSessionEvent } from "@/lib/sessionEvents"
import { resumeOrphanSession, type OrphanSession } from "@/lib/resumeSession"
import { supabase } from "@/lib/supabase"
import type { SessionState } from "@/store/atoms"

export interface StartSessionOpts {
  skipCycle?: boolean
}

interface PendingStart {
  opts: StartSessionOpts
  orphan: OpenSessionRow
}

export interface UseStartSessionGuardResult {
  pending: PendingStart | null
  guard: (opts?: StartSessionOpts) => Promise<void>
  finish: () => Promise<void>
  resume: () => void
}

/**
 * Closes a blocking session with the #568 last-set payload (`finished_at` =
 * last set, never `now()`). Threshold 0 because the guard closes any open row
 * the user chose to finish, recent or abandoned.
 */
async function closeBlockingSession(row: OpenSessionRow): Promise<boolean> {
  const close = computeOrphanClose(row.set_logs ?? [], Date.now(), 0)
  if (!close) return false

  const { error } = await supabase
    .from("sessions")
    .update({
      finished_at: close.finishedAt,
      total_sets_done: close.totalSetsDone,
      active_duration_ms: close.activeDurationMs,
      has_skipped_sets: false,
    })
    .eq("id", row.id)
    .is("finished_at", null)

  return !error
}

function toOrphanSession(row: OpenSessionRow): OrphanSession {
  return {
    id: row.id,
    workout_day_id: row.workout_day_id,
    workout_label_snapshot: row.workout_label_snapshot ?? "",
    started_at: row.started_at,
    cycle_id: row.cycle_id,
  }
}

/**
 * DB-backed guard before a session may start (#571, trigger 2). Reads the
 * user's open sessions — not the local atom, which a reload or another device
 * erases — and, when one exists, parks the start behind a Finish / Resume
 * choice instead of committing a second open row.
 */
export function useStartSessionGuard({
  userId,
  session,
  commitStart,
}: {
  userId: string | null
  session: SessionState
  commitStart: (opts: StartSessionOpts) => void | Promise<void>
}): UseStartSessionGuardResult {
  const [pending, setPending] = useState<PendingStart | null>(null)

  const guard = useCallback(
    async (opts: StartSessionOpts = {}) => {
      let orphan: OpenSessionRow | null = null
      try {
        orphan = userId ? await findBlockingOpenSession(userId, session) : null
      } catch (error) {
        // Offline is the only realistic failure; blocking a start on a dead
        // network is worse than the rare lost-atom-offline orphan.
        console.warn(
          "[WorkoutPage] start-session guard failed; starting anyway",
          error,
        )
      }
      if (!orphan) {
        await commitStart(opts)
        return
      }
      trackSessionEvent("session_start_blocked", { session_id: orphan.id })
      setPending({ opts, orphan })
    },
    [userId, session, commitStart],
  )

  const finish = useCallback(async () => {
    if (!pending) return
    // A zero-set row or an update error leaves the row open; starting anyway
    // would recreate the second-open-row state this guard exists to prevent.
    // Keep the dialog up so the user can still Resume.
    const closed = await closeBlockingSession(pending.orphan)
    if (!closed) return
    trackSessionEvent("session_orphan_closed", {
      cause: "start_guard",
      session_id: pending.orphan.id,
    })
    const opts = pending.opts
    setPending(null)
    // Re-run the guard: closing one row does not rule out another blocker.
    await guard(opts)
  }, [pending, guard])

  const resume = useCallback(() => {
    if (!pending || !userId) return
    resumeOrphanSession(toOrphanSession(pending.orphan), userId)
    trackSessionEvent("session_orphan_resumed", {
      surface: "start_guard",
      session_id: pending.orphan.id,
    })
    setPending(null)
  }, [pending, userId])

  return { pending, guard, finish, resume }
}
