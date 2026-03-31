import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function useDeleteSavedWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dayId: string) => {
      const { error } = await supabase
        .from("workout_days")
        .delete()
        .eq("id", dayId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-workouts"] })
    },
  })
}
