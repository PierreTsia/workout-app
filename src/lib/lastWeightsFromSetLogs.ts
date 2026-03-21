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

/** Latest logged weight (kg) per exercise_id from set_logs, same semantics as useLastWeights. */
export async function fetchLastWeightsForExerciseIds(
  exerciseIds: string[],
): Promise<Record<string, number>> {
  const sortedIds = [...exerciseIds].sort()
  if (sortedIds.length === 0) return {}

  const { data, error } = await supabase
    .from("set_logs")
    .select("exercise_id, weight_logged, logged_at")
    .in("exercise_id", sortedIds)
    .order("logged_at", { ascending: false })
    .limit(sortedIds.length * 50)

  if (error) throw error
  if (!data || data.length === 0) return {}

  return latestWeightPerExerciseFromRows(data)
}
