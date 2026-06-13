import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { FULL_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import type { ExerciseBlockWithExercises } from "@/types/database"

/**
 * Loads all `exercise_blocks` for a day with their `block_exercises` and the
 * embedded catalog `exercises` row. Mirrors `useWorkoutExercises` for the block
 * half of the Unified Day Sequence (#351).
 */
export function useExerciseBlocks(dayId: string | null) {
  return useQuery<ExerciseBlockWithExercises[]>({
    queryKey: ["exercise-blocks", dayId],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_blocks")
        .select(
          `*, exercises:block_exercises(*, exercise:exercises(${FULL_EXERCISE_SELECT}))`,
        )
        .eq("workout_day_id", dayId!)
        .order("sort_order")

      if (error) throw error

      return (data ?? []) as ExerciseBlockWithExercises[]
    },
    enabled: !!dayId,
  })
}
