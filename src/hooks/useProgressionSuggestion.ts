import { useMemo } from "react"
import { useLastSessionDetail } from "@/hooks/useLastSessionDetail"
import {
  computeNextSessionTarget,
  resolveWeightIncrement,
  type ProgressionPrescription,
  type ProgressionSuggestion,
  type VolumePrescription,
} from "@/lib/progression"
import type { WorkoutExercise, Exercise } from "@/types/database"

const DEFAULT_DURATION_SECONDS = 30
const DURATION_BAND_LOW = 10
const DURATION_BAND_HIGH = 15
const DEFAULT_DURATION_INCREMENT = 5

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

    const isDuration = measurementType === "duration"

    let volume: VolumePrescription

    if (isDuration) {
      const target =
        exercise.target_duration_seconds ??
        catalogExercise?.default_duration_seconds ??
        DEFAULT_DURATION_SECONDS
      volume = {
        type: "duration",
        current: target,
        min: exercise.duration_range_min_seconds ?? Math.max(5, target - DURATION_BAND_LOW),
        max: exercise.duration_range_max_seconds ?? target + DURATION_BAND_HIGH,
        increment: exercise.duration_increment_seconds ?? DEFAULT_DURATION_INCREMENT,
      }
    } else {
      let currentReps = parseInt(exercise.reps, 10)
      if (isNaN(currentReps)) {
        const inferredReps = lastPerformance[0]?.reps
        if (!inferredReps || inferredReps <= 0) return null
        currentReps = inferredReps
      }
      volume = {
        type: "reps",
        current: currentReps,
        min: exercise.rep_range_min ?? Math.max(1, currentReps - 2),
        max: exercise.rep_range_max ?? currentReps + 2,
        increment: 1,
      }
    }

    const templateWeight = Number(exercise.weight) || 0
    const lastSessionWeight = lastPerformance[0]?.weight ?? 0
    const currentWeight = lastSessionWeight > 0 ? lastSessionWeight : templateWeight

    const prescription: ProgressionPrescription = {
      volume,
      currentWeight,
      currentSets: exercise.sets,
      setRangeMin: exercise.set_range_min ?? Math.max(1, exercise.sets - 1),
      setRangeMax: exercise.set_range_max ?? Math.min(6, exercise.sets + 2),
      weightIncrement: resolveWeightIncrement(exercise.weight_increment ?? null, equipment),
      maxWeightReached: exercise.max_weight_reached ?? false,
      currentReps: volume.type === "reps" ? volume.current : 0,
      repRangeMin: volume.type === "reps" ? volume.min : 0,
      repRangeMax: volume.type === "reps" ? volume.max : 0,
    }

    return computeNextSessionTarget(prescription, lastPerformance)
  }, [exercise, lastPerformance, measurementType, equipment, catalogExercise])
}
