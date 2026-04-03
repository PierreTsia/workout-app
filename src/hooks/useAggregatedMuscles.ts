import { useMemo } from "react"
import { buildBodyMapData } from "@/lib/muscleMapping"
import { useExerciseBatch } from "@/hooks/useExerciseBatch"
import type { WorkoutExercise } from "@/types/database"
import type { IExerciseData } from "react-body-highlighter"

/**
 * Resolves library exercises for a list of WorkoutExercises (one batched
 * `/exercises` query), then aggregates muscle data for the body map.
 * Populates `["exercise", id]` via {@link useExerciseBatch} for other hooks.
 */
export function useAggregatedMuscles(exercises: WorkoutExercise[]): IExerciseData[] {
  const exerciseIds = useMemo(
    () => exercises.map((ex) => ex.exercise_id),
    [exercises],
  )

  const { data: libRows = [] } = useExerciseBatch(exerciseIds)

  const byId = useMemo(
    () => new Map(libRows.map((e) => [e.id, e] as const)),
    [libRows],
  )

  return useMemo(() => {
    return buildBodyMapData(
      exercises.map((ex) => {
        const lib = byId.get(ex.exercise_id)
        return {
          name: ex.name_snapshot,
          muscleGroup: lib?.muscle_group ?? ex.muscle_snapshot,
          secondaryMuscles: lib?.secondary_muscles,
          sets: ex.sets,
        }
      }),
    )
  }, [exercises, byId])
}
