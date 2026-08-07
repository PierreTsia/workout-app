import { useQuery } from "@tanstack/react-query"
import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import {
  buildPrescription,
  computeNextSessionTarget,
  type ProgressionSuggestion,
  type SetPerformance,
} from "@/lib/progression"
import type { WorkoutExercise } from "@/types/database"

export interface UseProgressionSuggestionsForDayResult {
  data: Map<string, ProgressionSuggestion | null>
  isLoading: boolean
  /**
   * Supabase RPC errors come as `PostgrestError` (not `instanceof Error`).
   * Typing it accurately so consumers don't accidentally rely on `Error`
   * semantics like `.stack` / `.name` that won't be there.
   */
  error: PostgrestError | null
}

interface LastPerformanceRow {
  workout_exercise_id: string
  exercise_id: string
  session_id: string
  set_number: number
  reps_logged: string | null
  weight_logged: number
  rir: number | null
  duration_seconds: number | null
  logged_at: string
  // Prescription Snapshot fields — nullable for legacy/in-flight rows. ADR 0006.
  prescribed_reps: number | null
  prescribed_weight: number | null
  prescribed_sets: number | null
  prescribed_duration_seconds: number | null
  // Denormalized from sessions.finished_at — same value repeated on every row
  // of the latest session. Engine gates the snapshot read on this.
  session_finished_at: string | null
}

/** Defensive zip check for parallel RPC arrays (#463 / T173). Exported for tests. */
export function requireParallelSlotArrays(
  workoutExerciseIds: string[],
  exerciseIds: string[],
): void {
  if (workoutExerciseIds.length !== exerciseIds.length) {
    throw new Error(
      `get_last_performance_for_slots: parallel arrays length mismatch ` +
        `(${workoutExerciseIds.length} vs ${exerciseIds.length})`,
    )
  }
}

function rowToSetPerformance(row: LastPerformanceRow): SetPerformance {
  const reps = parseInt(String(row.reps_logged ?? ""), 10)
  return {
    reps: isNaN(reps) ? 0 : reps,
    weight: Number(row.weight_logged) || 0,
    completed: true,
    rir: row.rir,
    durationSeconds: row.duration_seconds ?? undefined,
    prescribedReps: row.prescribed_reps,
    prescribedWeight: row.prescribed_weight,
    prescribedSets: row.prescribed_sets,
    prescribedDurationSeconds: row.prescribed_duration_seconds,
  }
}

function groupRowsByWorkoutExerciseId(
  rows: LastPerformanceRow[],
): Map<string, LastPerformanceRow[]> {
  return rows.reduce<Map<string, LastPerformanceRow[]>>((acc, row) => {
    const list = acc.get(row.workout_exercise_id)
    if (list) {
      list.push(row)
    } else {
      acc.set(row.workout_exercise_id, [row])
    }
    return acc
  }, new Map())
}

function inferMeasurementType(
  rows: LastPerformanceRow[],
): "reps" | "duration" {
  return rows.some((row) => row.duration_seconds != null) ? "duration" : "reps"
}

function computeSuggestion(
  exercise: WorkoutExercise,
  rows: LastPerformanceRow[],
): ProgressionSuggestion | null {
  const lastPerformance = rows.length > 0 ? rows.map(rowToSetPerformance) : null
  const lastSessionFinishedAt = rows[0]?.session_finished_at ?? null
  const prescription = buildPrescription(exercise, lastPerformance, {
    measurementType: inferMeasurementType(rows),
    lastSessionFinishedAt,
  })
  if (prescription === null) return null
  return computeNextSessionTarget(prescription, lastPerformance)
}

export function useProgressionSuggestionsForDay(
  dayId: string | null,
  exercises: WorkoutExercise[],
): UseProgressionSuggestionsForDayResult {
  const enabled = exercises.length > 0 && dayId != null

  const query = useQuery<
    Map<string, ProgressionSuggestion | null>,
    PostgrestError
  >({
    queryKey: [
      "progression-suggestions-for-day",
      dayId,
      exercises
        .map((e) => `${e.id}:${e.exercise_id}`)
        .sort()
        .join(","),
    ],
    queryFn: async () => {
      const workoutExerciseIds = exercises.map((e) => e.id)
      const exerciseIds = exercises.map((e) => e.exercise_id)
      requireParallelSlotArrays(workoutExerciseIds, exerciseIds)

      const { data, error } = await supabase.rpc(
        "get_last_performance_for_slots",
        {
          p_workout_exercise_ids: workoutExerciseIds,
          p_exercise_ids: exerciseIds,
        },
      )
      if (error) throw error

      const rowsBySlot = groupRowsByWorkoutExerciseId(
        (data ?? []) as LastPerformanceRow[],
      )

      return exercises.reduce<Map<string, ProgressionSuggestion | null>>(
        (acc, exercise) => {
          const rows = rowsBySlot.get(exercise.id) ?? []
          acc.set(exercise.id, computeSuggestion(exercise, rows))
          return acc
        },
        new Map(),
      )
    },
    enabled,
    staleTime: 30_000,
  })

  return {
    data: query.data ?? new Map<string, ProgressionSuggestion | null>(),
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
