import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { WorkoutExercise } from "@/types/database"

export function useWorkoutExercises(dayId: string | null) {
  return useQuery<WorkoutExercise[]>({
    queryKey: ["workout-exercises", dayId],
    /** Template rows change often (builder, permanent add/swap/delete); avoid long-lived stale lists. */
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select("*")
        .eq("workout_day_id", dayId!)
        .order("sort_order")

      if (error) throw error
      return data as WorkoutExercise[]
    },
    enabled: !!dayId,
  })
}
