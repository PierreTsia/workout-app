import { useMemo } from "react"
import { useLastSessionDetail } from "@/hooks/useLastSessionDetail"
import {
  computeNextSessionTarget,
  resolveWeightIncrement,
  type ProgressionPrescription,
  type ProgressionSuggestion,
} from "@/lib/progression"
import type { WorkoutExercise } from "@/types/database"

export function useProgressionSuggestion(
  exercise: WorkoutExercise,
  measurementType?: "reps" | "duration",
  equipment?: string,
): ProgressionSuggestion | null {
  const { data: lastPerformance } = useLastSessionDetail(exercise.exercise_id)

  return useMemo(() => {
    if (measurementType === "duration") return null
    if (!lastPerformance || lastPerformance.length === 0) return null

    let currentReps = parseInt(exercise.reps, 10)
    if (isNaN(currentReps)) {
      const inferredReps = lastPerformance[0]?.reps
      if (!inferredReps || inferredReps <= 0) return null
      currentReps = inferredReps
    }

    const templateWeight = Number(exercise.weight) || 0
    const lastSessionWeight = lastPerformance[0]?.weight ?? 0
    const currentWeight = lastSessionWeight > 0 ? lastSessionWeight : templateWeight

    const prescription: ProgressionPrescription = {
      currentReps,
      currentWeight,
      currentSets: exercise.sets,
      repRangeMin: exercise.rep_range_min ?? Math.max(1, currentReps - 2),
      repRangeMax: exercise.rep_range_max ?? currentReps + 2,
      setRangeMin: exercise.set_range_min ?? Math.max(1, exercise.sets - 1),
      setRangeMax: exercise.set_range_max ?? Math.min(6, exercise.sets + 2),
      weightIncrement: resolveWeightIncrement(exercise.weight_increment ?? null, equipment),
      maxWeightReached: exercise.max_weight_reached ?? false,
    }

    return computeNextSessionTarget(prescription, lastPerformance)
  }, [exercise, lastPerformance, measurementType, equipment])
}
