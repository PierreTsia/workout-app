import { useQuery } from "@tanstack/react-query"
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
  error: Error | null
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
  return rows.reduce<Map<string, LastPerformanceRow[]>>((acc, row) => {
    const existing = acc.get(row.exercise_id) ?? []
    acc.set(row.exercise_id, [...existing, row])
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

  const query = useQuery<Map<string, ProgressionSuggestion | null>>({
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

      return exercises.reduce<Map<string, ProgressionSuggestion | null>>(
        (acc, exercise) => {
          const rows = rowsByExercise.get(exercise.exercise_id) ?? []
          acc.set(exercise.exercise_id, computeSuggestion(exercise, rows))
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
    error: (query.error as Error | null) ?? null,
  }
}
