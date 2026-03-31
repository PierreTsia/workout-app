import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function useStartSavedWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dayId: string) => {
      const { error } = await supabase
        .from("workout_days")
        .update({ saved_at: null })
        .eq("id", dayId)
      if (error) throw error
      return { dayId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-workouts"] })
    },
  })
}
