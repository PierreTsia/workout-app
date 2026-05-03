import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { resolveOrCreateActiveCycle } from "@/lib/cycle"

interface AbandonAndRestartArgs {
  cycleId: string
  programId: string
  userId: string
}

interface AbandonAndRestartResult {
  newCycleId: string
}

/**
 * Closes the user's active cycle (even if incomplete) and opens a fresh one for
 * the same program. Sessions and set_logs of the closed cycle stay attached via
 * `cycle_id` — zero data loss. Used by the "Recommencer un cycle" escape hatch
 * when a user wants to skip remaining sessions and start over.
 *
 * The close UPDATE is scoped by both `id` AND `user_id` — RLS already restricts
 * to the calling user, but explicit `user_id` is belt-and-braces against a
 * stale `cycleId` from a different program.
 *
 * On success we PRE-POPULATE the `["active-cycle", programId]` cache with the
 * new cycle row instead of just invalidating it. Reason: `WorkoutPage.startSession()`
 * reads `activeCycle?.id` from cache first and only falls back to
 * `resolveOrCreateActiveCycle` when the cache is null. A bare `invalidate` only
 * marks stale and triggers a background refetch — until the refetch returns,
 * `startSession()` would use the closed cycle id and attach the next session
 * to a finished cycle. Pre-populating closes that race window.
 *
 * On partial failure (close ok but resolve unavailable), the mutation rejects;
 * `resolveOrCreateActiveCycle` will self-heal on the next session-start call.
 */
export function useAbandonAndRestartCycle() {
  const queryClient = useQueryClient()

  return useMutation<AbandonAndRestartResult, Error, AbandonAndRestartArgs>({
    mutationFn: async ({ cycleId, programId, userId }) => {
      const { error } = await supabase
        .from("cycles")
        .update({ finished_at: new Date().toISOString() })
        .eq("id", cycleId)
        .eq("user_id", userId)

      if (error) throw error

      const result = await resolveOrCreateActiveCycle(programId, userId)
      if (result.kind !== "ok") {
        // Close succeeded — make sure the cache reflects it so the UI doesn't
        // keep showing the now-finished cycle as active until a manual refetch.
        queryClient.invalidateQueries({ queryKey: ["active-cycle", programId] })
        throw new Error(result.reason)
      }

      return { newCycleId: result.cycleId }
    },
    onSuccess: ({ newCycleId }, { programId, userId }) => {
      queryClient.setQueryData(["active-cycle", programId], {
        id: newCycleId,
        program_id: programId,
        user_id: userId,
        started_at: new Date().toISOString(),
        finished_at: null,
      })
      queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
      queryClient.invalidateQueries({ queryKey: ["workout-exercises"] })
    },
  })
}
