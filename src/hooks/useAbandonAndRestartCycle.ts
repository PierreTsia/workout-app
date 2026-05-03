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
 * If the close request errors, the new cycle is NOT created and the mutation
 * rejects. If close succeeds but new-cycle resolution fails (network/RLS), the
 * user has no open cycle for that program — `resolveOrCreateActiveCycle` will
 * self-heal on the next session-start interaction.
 */
export function useAbandonAndRestartCycle() {
  const queryClient = useQueryClient()

  return useMutation<AbandonAndRestartResult, Error, AbandonAndRestartArgs>({
    mutationFn: async ({ cycleId, programId, userId }) => {
      const { error } = await supabase
        .from("cycles")
        .update({ finished_at: new Date().toISOString() })
        .eq("id", cycleId)

      if (error) throw error

      const result = await resolveOrCreateActiveCycle(programId, userId)
      if (result.kind !== "ok") {
        throw new Error(result.reason)
      }

      return { newCycleId: result.cycleId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-cycle"] })
      queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
      queryClient.invalidateQueries({ queryKey: ["workout-exercises"] })
    },
  })
}
