import { getDefaultStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { queryClient } from "@/lib/queryClient"
import {
  authAtom,
  sessionAtom,
  restAtom,
  isQuickWorkoutAtom,
  defaultSessionState,
} from "@/store/atoms"
import {
  discardSessionQueue,
  markSessionCancelled,
  peekSessionRealId,
} from "@/lib/syncService"
import { clearSessionExercisePatchStorage } from "@/lib/sessionExercisePatchStorage"

const store = getDefaultStore()

/**
 * Reset every atom + localStorage piece that represents an active session.
 *
 * Used by both `cancelActiveSession` (Cancel button) and
 * `WorkoutPage.handleNewSession` (post-finish "New Session"). Single source
 * of truth for "no active session" state.
 *
 * Does NOT touch local React state inside `WorkoutPage` (finishedStats,
 * finishedQuickInfo, prFlags, …). Those only matter post-finish; during an
 * active session they are already in their initial state.
 */
export function resetSessionAtoms(): void {
  store.set(sessionAtom, defaultSessionState)
  store.set(restAtom, null)
  store.set(isQuickWorkoutAtom, false)
  clearSessionExercisePatchStorage()
}

/**
 * Cancel the currently active session. Three-layer wipe:
 *   1. Sync queue + sessionMeta (pure local).
 *   2. Cancellation deny-list so any future drain skips this real session id.
 *   3. Supabase rows (best-effort) — `set_logs` cascade via FK ON DELETE.
 *
 * Always finishes by resetting the session atoms so the UI lands back on
 * the day picker, regardless of whether server cleanup succeeded.
 *
 * Idempotent: returns early when no session is active.
 */
export async function cancelActiveSession(): Promise<void> {
  const session = store.get(sessionAtom)
  const auth = store.get(authAtom)

  if (!session.isActive || session.startedAt == null) return

  const userId = auth?.id ?? null
  const localSessionId = `local-${session.startedAt}`
  const cycleId = session.cycleId
  const realSessionId = userId
    ? peekSessionRealId(userId, localSessionId)
    : null
  // Preserve the day the user was on so the day picker re-opens on the same
  // workout day after cancel (instead of resetting to the first day, which
  // may already be completed in the current cycle).
  const preservedDayId = session.currentDayId

  if (userId && realSessionId) {
    markSessionCancelled(realSessionId)
    discardSessionQueue(realSessionId)

    try {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", realSessionId)
        .eq("user_id", userId)
      if (error) {
        console.warn("[cancelSession] sessions delete failed", error)
      }
    } catch (e) {
      console.warn("[cancelSession] sessions delete threw", e)
    }

    if (cycleId) {
      // The `count` is an optimization to skip the network round-trip when
      // siblings exist; the real safety is the `cycle_id` FK on `sessions`,
      // which has no ON DELETE clause (NO ACTION). If a session sneaks in
      // between count and delete, the FK aborts the delete and we swallow
      // the error → cycle stays. Net: race-safe.
      try {
        const { count, error: countError } = await supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("cycle_id", cycleId)
        if (countError) {
          console.warn("[cancelSession] cycle session count failed", countError)
        } else if ((count ?? 0) === 0) {
          const { error: cycleDeleteError } = await supabase
            .from("cycles")
            .delete()
            .eq("id", cycleId)
            .is("finished_at", null)
          if (cycleDeleteError) {
            console.warn(
              "[cancelSession] empty cycle delete failed",
              cycleDeleteError,
            )
          }
        }
      } catch (e) {
        console.warn("[cancelSession] cycle cleanup threw", e)
      }
    }
  }

  resetSessionAtoms()
  if (preservedDayId) {
    store.set(sessionAtom, {
      ...store.get(sessionAtom),
      currentDayId: preservedDayId,
    })
  }

  // Refresh anything that may have shown the cancelled session pre-cancel.
  queryClient.invalidateQueries({ queryKey: ["sessions"] })
  queryClient.invalidateQueries({ queryKey: ["sessions-date-range"] })
  queryClient.invalidateQueries({ queryKey: ["training-activity-by-day"] })
  queryClient.invalidateQueries({ queryKey: ["active-cycle"] })
  queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
}
