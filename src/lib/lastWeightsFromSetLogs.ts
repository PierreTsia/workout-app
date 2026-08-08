import { supabase } from "@/lib/supabase"

/**
 * Rows must be ordered newest-first (e.g. `logged_at` desc). First occurrence per
 * `exercise_id` wins — that is the latest set for that exercise.
 */
export function latestWeightPerExerciseFromRows(
  rows: { exercise_id: string; weight_logged: number | string }[],
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const row of rows) {
    if (!(row.exercise_id in result)) {
      result[row.exercise_id] = Number(row.weight_logged)
    }
  }
  return result
}

/**
 * Same newest-first rule, keyed by **Exercise Slot** (`workout_exercise_id`).
 * Used for existing-slot session prefill (#463 / T175).
 */
export function latestWeightPerSlotFromRows(
  rows: { workout_exercise_id: string; weight_logged: number | string }[],
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const row of rows) {
    if (!(row.workout_exercise_id in result)) {
      result[row.workout_exercise_id] = Number(row.weight_logged)
    }
  }
  return result
}

export type SlotWeightRef = {
  workoutExerciseId: string
  exerciseId: string
}

/** Latest logged weight (kg) per exercise_id from set_logs — catalog-global (add/swap seed). */
export async function fetchLastWeightsForExerciseIds(
  exerciseIds: string[],
): Promise<Record<string, number>> {
  const sortedIds = [...exerciseIds].sort()
  if (sortedIds.length === 0) return {}

  const { data, error } = await supabase
    .from("set_logs")
    .select("exercise_id, weight_logged, logged_at")
    .in("exercise_id", sortedIds)
    // Block work is out of the progression engine (ADR 0007) — never prefill from it.
    .is("block_exercise_id", null)
    .order("logged_at", { ascending: false })
    .limit(sortedIds.length * 50)

  if (error) throw error
  if (!data || data.length === 0) return {}

  return latestWeightPerExerciseFromRows(data)
}

type SlotPerformanceWeightRow = {
  workout_exercise_id: string | null
  weight_logged: number | string | null
  logged_at: string | null
}

/**
 * Latest logged weight (kg) per **Exercise Slot**, matched on
 * `(workout_exercise_id, exercise_id)`. Existing-slot prefill only (#463).
 *
 * Uses `get_last_performance_for_slots` (DISTINCT ON per slot) so a hot slot
 * cannot crowd out others via a shared PostgREST `.limit`.
 */
export async function fetchLastWeightsForSlots(
  slots: SlotWeightRef[],
): Promise<Record<string, number>> {
  if (slots.length === 0) return {}

  const workoutExerciseIds = slots.map((s) => s.workoutExerciseId)
  const exerciseIds = slots.map((s) => s.exerciseId)

  const { data, error } = await supabase.rpc("get_last_performance_for_slots", {
    p_workout_exercise_ids: workoutExerciseIds,
    p_exercise_ids: exerciseIds,
  })

  if (error) throw error
  if (!data || data.length === 0) return {}

  const rows: SlotPerformanceWeightRow[] = data
  const newestFirst = [...rows].sort((a, b) => {
    const aAt = a.logged_at ? Date.parse(a.logged_at) : 0
    const bAt = b.logged_at ? Date.parse(b.logged_at) : 0
    return bAt - aAt
  })

  return latestWeightPerSlotFromRows(
    newestFirst.flatMap((row) => {
      if (row.workout_exercise_id == null || row.weight_logged == null) {
        return []
      }
      return [
        {
          workout_exercise_id: row.workout_exercise_id,
          weight_logged: row.weight_logged,
        },
      ]
    }),
  )
}
