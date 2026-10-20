import { useEffect, useMemo, useRef } from "react"
import { useLastSessionDetail } from "@/hooks/useLastSessionDetail"
import {
  buildPrescription,
  computeNextSessionTarget,
  type ProgressionSuggestion,
} from "@/lib/progression"
import { trackProgressionRuleServed } from "@/lib/progressionRuleTelemetry"
import type { WorkoutExercise, Exercise } from "@/types/database"

export function useProgressionSuggestion(
  exercise: WorkoutExercise,
  measurementType?: "reps" | "duration",
  equipment?: string,
  sessionStartedAt?: number | null,
  catalogExercise?: Exercise | null,
  sessionId?: string,
): ProgressionSuggestion | null {
  const { data: lastSessionDetail } = useLastSessionDetail(
    exercise.id,
    exercise.exercise_id,
    sessionStartedAt,
    measurementType,
  )

  const suggestion = useMemo(() => {
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

  // T706 — one event per slot and session, from the in-session seam only. The
  // rule enum is never persisted elsewhere; this is the only record of what was
  // actually served. Keyed by session + slot so a re-render never double-counts.
  const trackedKey = useRef<string | null>(null)
  useEffect(() => {
    if (!suggestion || !sessionId) return
    const key = `${sessionId}:${exercise.id}`
    if (trackedKey.current === key) return
    trackedKey.current = key
    trackProgressionRuleServed({
      rule: suggestion.rule,
      volumeType: suggestion.volumeType,
      workoutExerciseId: exercise.id,
      exerciseId: exercise.exercise_id,
      sessionId,
    })
  }, [suggestion, sessionId, exercise.id, exercise.exercise_id])

  return suggestion
}
