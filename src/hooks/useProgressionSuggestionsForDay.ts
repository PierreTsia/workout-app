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
  exercise_id: string
  session_id: string
  set_number: number
  reps_logged: string | null
  weight_logged: number
  rir: number | null
  duration_seconds: number | null
  logged_at: string
}

function rowToSetPerformance(row: LastPerformanceRow): SetPerformance {
  const reps = parseInt(String(row.reps_logged ?? ""), 10)
  return {
    reps: isNaN(reps) ? 0 : reps,
    weight: Number(row.weight_logged) || 0,
    completed: true,
    rir: row.rir,
    durationSeconds: row.duration_seconds ?? undefined,
  }
}

function groupRowsByExerciseId(
  rows: LastPerformanceRow[],
): Map<string, LastPerformanceRow[]> {
  // Local push into the bucket array — the bucket is owned by the Map we're
  // building and never escapes this function before assembly is complete, so
  // semantically pure. Avoids O(N²) allocations from `[...existing, row]`.
  return rows.reduce<Map<string, LastPerformanceRow[]>>((acc, row) => {
    const list = acc.get(row.exercise_id)
    if (list) {
      list.push(row)
    } else {
      acc.set(row.exercise_id, [row])
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
  const prescription = buildPrescription(exercise, lastPerformance, {
    measurementType: inferMeasurementType(rows),
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
        .map((e) => e.exercise_id)
        .sort()
        .join(","),
    ],
    queryFn: async () => {
      const exerciseIds = exercises.map((e) => e.exercise_id)
      const { data, error } = await supabase.rpc(
        "get_last_performance_for_exercises",
        { p_exercise_ids: exerciseIds },
      )
      if (error) throw error

      const rowsByExercise = groupRowsByExerciseId(
        (data ?? []) as LastPerformanceRow[],
      )

      // Keyed by `workout_exercises.id` (the row id) — not `exercise_id` —
      // so two rows of the same exercise in a day stay independent (e.g. a
      // user may queue the same movement twice with different prescriptions).
      // Same `exercise_id` will read the same Last Performance from set_logs;
      // resolving the deeper "two rows of the same exo, different intent"
      // conflation is a pre-existing limitation tracked outside this PR.
      return exercises.reduce<Map<string, ProgressionSuggestion | null>>(
        (acc, exercise) => {
          const rows = rowsByExercise.get(exercise.exercise_id) ?? []
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
