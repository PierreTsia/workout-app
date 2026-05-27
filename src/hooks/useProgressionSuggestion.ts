import { useMemo } from "react"
import { useLastSessionDetail } from "@/hooks/useLastSessionDetail"
import {
  buildPrescription,
  computeNextSessionTarget,
  type ProgressionSuggestion,
} from "@/lib/progression"
import type { WorkoutExercise, Exercise } from "@/types/database"

export function useProgressionSuggestion(
  exercise: WorkoutExercise,
  measurementType?: "reps" | "duration",
  equipment?: string,
  sessionStartedAt?: number | null,
  catalogExercise?: Exercise | null,
): ProgressionSuggestion | null {
  const { data: lastPerformance } = useLastSessionDetail(
    exercise.exercise_id,
    sessionStartedAt,
    measurementType,
  )

  return useMemo(() => {
    if (!lastPerformance || lastPerformance.length === 0) return null

    const prescription = buildPrescription(exercise, lastPerformance, {
      measurementType,
      equipment,
      catalogExercise,
    })
    if (prescription === null) return null

    return computeNextSessionTarget(prescription, lastPerformance)
  }, [exercise, lastPerformance, measurementType, equipment, catalogExercise])
}
