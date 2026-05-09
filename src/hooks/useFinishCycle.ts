import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSetAtom } from "jotai"
import { supabase } from "@/lib/supabase"
import { restAtom } from "@/store/atoms"

/**
 * Closes a cycle by setting `finished_at`. Idempotent: the
 * `.is("finished_at", null)` filter makes a re-run a no-op once the cycle is
 * already closed, so this is safe to call from a self-heal effect that may
 * race with the sync queue's auto-close path.
 *
 * Used by `useAutoCloseStuckCycle` to repair the legacy stuck-cycle state for
 * users who hit the bug before the auto-close payload existed.
 */
export function useFinishCycle() {
  const queryClient = useQueryClient()
  const setRest = useSetAtom(restAtom)

  return useMutation({
    mutationFn: async (cycleId: string) => {
      const { error } = await supabase
        .from("cycles")
        .update({ finished_at: new Date().toISOString() })
        .eq("id", cycleId)
        .is("finished_at", null)

      if (error) throw error
    },
    onSuccess: () => {
      setRest(null)
      queryClient.invalidateQueries({ queryKey: ["active-cycle"] })
      queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
      queryClient.invalidateQueries({ queryKey: ["workout-exercises"] })
    },
  })
}
