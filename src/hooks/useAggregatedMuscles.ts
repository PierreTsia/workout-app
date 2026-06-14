import { useMemo } from "react"
import { buildBodyMapData } from "@/lib/muscleMapping"
import { useExerciseBatch } from "@/hooks/useExerciseBatch"
import type {
  ExerciseBlockWithExercises,
  WorkoutExercise,
} from "@/types/database"
import type { IExerciseData } from "react-body-highlighter"

/** What the body map needs from any movement — a solo exercise or a block exercise. */
interface MuscleContributor {
  name: string
  exerciseId: string
  /** Fallback primary muscle when the library row can't be resolved. */
  muscleFallback: string
  /** Aggregation weight = times performed: solo `sets`, or a block exercise's `rounds`. */
  sets: number
}

/**
 * Resolves library exercises for a day's movements (one batched `/exercises`
 * query), then aggregates muscle data for the body map. Block exercises (#351)
 * are folded in, each weighted by its block's round count. Populates
 * `["exercise", id]` via {@link useExerciseBatch} for other hooks.
 */
export function useAggregatedMuscles(
  exercises: WorkoutExercise[],
  blocks: ExerciseBlockWithExercises[] = [],
): IExerciseData[] {
  const contributors = useMemo<MuscleContributor[]>(
    () => [
      ...exercises.map((ex) => ({
        name: ex.name_snapshot,
        exerciseId: ex.exercise_id,
        muscleFallback: ex.muscle_snapshot,
        sets: ex.sets,
      })),
      ...blocks.flatMap((b) =>
        b.exercises.map((be) => ({
          name: be.name_snapshot,
          exerciseId: be.exercise_id,
          muscleFallback: be.muscle_snapshot,
          sets: b.rounds,
        })),
      ),
    ],
    [exercises, blocks],
  )

  const exerciseIds = useMemo(
    () => contributors.map((c) => c.exerciseId),
    [contributors],
  )

  const { data: libRows = [] } = useExerciseBatch(exerciseIds)

  const byId = useMemo(
    () => new Map(libRows.map((e) => [e.id, e] as const)),
    [libRows],
  )

  return useMemo(() => {
    return buildBodyMapData(
      contributors.map((c) => {
        const lib = byId.get(c.exerciseId)
        return {
          name: c.name,
          muscleGroup: lib?.muscle_group ?? c.muscleFallback,
          secondaryMuscles: lib?.secondary_muscles,
          sets: c.sets,
        }
      }),
    )
  }, [contributors, byId])
}
