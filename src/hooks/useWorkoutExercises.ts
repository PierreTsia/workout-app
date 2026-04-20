import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type {
  Exercise,
  WorkoutExerciseWithExercise,
} from "@/types/database"

/**
 * Loads all `workout_exercises` for a day WITH the related `exercises` row
 * embedded (PostgREST resource embedding). Two goals:
 *
 *  1. Kill the per-id `exercises?id=eq…` request storm that `useExerciseById`
 *     used to trigger for every card on the session/home screens (N+1 → 1).
 *  2. Warm the per-id cache (`["exercise", id]`) so downstream callers of
 *     `useExerciseFromLibrary` / `useExerciseById` hit memory instead of
 *     the network.
 */
export function useWorkoutExercises(dayId: string | null) {
  const queryClient = useQueryClient()

  return useQuery<WorkoutExerciseWithExercise[]>({
    queryKey: ["workout-exercises", dayId],
    /** Template rows change often (builder, permanent add/swap/delete); avoid long-lived stale lists. */
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select(
          `
          *,
          exercise:exercises(*)
        `,
        )
        .eq("workout_day_id", dayId!)
        .order("sort_order")

      if (error) throw error

      const rows = (data ?? []) as WorkoutExerciseWithExercise[]

      const uniqueExercises = rows
        .map((row) => row.exercise)
        .filter((ex): ex is Exercise => !!ex)
        .reduce(
          (map, ex) => map.set(ex.id, ex),
          new Map<string, Exercise>(),
        )

      uniqueExercises.forEach((ex, id) => {
        queryClient.setQueryData(["exercise", id], ex)
      })

      return rows
    },
    enabled: !!dayId,
  })
}
