import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { buildBodyMapData } from "@/lib/muscleMapping"
import type { Exercise, WorkoutExercise } from "@/types/database"
import type { IExerciseData } from "react-body-highlighter"

async function fetchExercise(id: string): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return null
  return data
}

/**
 * Resolves library exercises for a list of WorkoutExercises,
 * then aggregates their muscle data into a body-map-ready shape.
 *
 * Uses the same ["exercise", id] cache key as useExerciseById,
 * so results are typically warm from ExerciseDetail rendering.
 */
export function useAggregatedMuscles(exercises: WorkoutExercise[]): IExerciseData[] {
  const queries = useQueries({
    queries: exercises.map((ex) => ({
      queryKey: ["exercise", ex.exercise_id],
      queryFn: () => fetchExercise(ex.exercise_id),
      staleTime: 5 * 60 * 1000,
    })),
  })

  return useMemo(() => {
    return buildBodyMapData(
      exercises.map((ex, i) => {
        const lib = queries[i]?.data
        return {
          name: ex.name_snapshot,
          muscleGroup: lib?.muscle_group ?? ex.muscle_snapshot,
          secondaryMuscles: lib?.secondary_muscles,
          sets: ex.sets,
        }
      }),
    )
  }, [exercises, queries])
}
