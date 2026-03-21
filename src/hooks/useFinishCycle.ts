import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function useFinishCycle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (cycleId: string) => {
      const { error } = await supabase
        .from("cycles")
        .update({ finished_at: new Date().toISOString() })
        .eq("id", cycleId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-cycle"] })
      queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
    },
  })
}
