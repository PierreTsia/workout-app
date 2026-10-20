import { useEffect, useMemo } from "react"
import { useStore } from "jotai"
import { useLastSessionDetail } from "@/hooks/useLastSessionDetail"
import {
  buildPrescription,
  computeNextSessionTarget,
  type ProgressionSuggestion,
} from "@/lib/progression"
import { trackProgressionRuleServed } from "@/lib/progressionRuleTelemetry"
import { sessionAtom } from "@/store/atoms"
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
  const store = useStore()

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
  // dedup lives in the session (not a hook ref): selecting a Circuit unmounts
  // ExerciseDetail, and a refresh remounts it — either would re-emit A after
  // A → B → A and inflate the observatory counts.
  useEffect(() => {
    if (!suggestion || !sessionId) return
    const tracked = store.get(sessionAtom).trackedRuleSlots ?? []
    if (tracked.includes(exercise.id)) return

    store.set(sessionAtom, (prev) => ({
      ...prev,
      trackedRuleSlots: [...(prev.trackedRuleSlots ?? []), exercise.id],
    }))
    trackProgressionRuleServed({
      rule: suggestion.rule,
      volumeType: suggestion.volumeType,
      workoutExerciseId: exercise.id,
      exerciseId: exercise.exercise_id,
      sessionId,
    })
  }, [suggestion, sessionId, exercise.id, exercise.exercise_id, store])

  return suggestion
}
