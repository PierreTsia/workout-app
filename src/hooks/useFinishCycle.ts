import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSetAtom } from "jotai"
import { supabase } from "@/lib/supabase"
import { restAtom } from "@/store/atoms"

export function useFinishCycle() {
  const queryClient = useQueryClient()
  const setRest = useSetAtom(restAtom)

  return useMutation({
    mutationFn: async (cycleId: string) => {
      const { error } = await supabase
        .from("cycles")
        .update({ finished_at: new Date().toISOString() })
        .eq("id", cycleId)

      if (error) throw error
    },
    onSuccess: () => {
      setRest(null)
      queryClient.invalidateQueries({ queryKey: ["active-cycle"] })
      queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
    },
  })
}
