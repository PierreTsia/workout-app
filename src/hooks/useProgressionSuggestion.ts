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
  const { data: lastSessionDetail } = useLastSessionDetail(
    exercise.exercise_id,
    sessionStartedAt,
    measurementType,
  )

  return useMemo(() => {
    if (!lastSessionDetail || lastSessionDetail.sets.length === 0) return null

    const { sets: lastPerformance, lastSessionFinishedAt } = lastSessionDetail
    const prescription = buildPrescription(exercise, lastPerformance, {
      measurementType,
      equipment,
      catalogExercise,
      lastSessionFinishedAt,
    })
    if (prescription === null) return null

    return computeNextSessionTarget(prescription, lastPerformance)
  }, [exercise, lastSessionDetail, measurementType, equipment, catalogExercise])
}
