/**
 * Shared exercise-catalog lookup for the MCP write tools (`create_program`,
 * `update_program`). Single batched `IN (...)` fetch — no per-id round-trip.
 *
 * Extracted from the inline `fetchExercisesByIds` previously private to
 * `tools/createProgram.ts` (T77). Behaviour is preserved verbatim.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"

const CATALOG_COLUMNS =
  "id, name, muscle_group, emoji, equipment, measurement_type, default_duration_seconds"

function catalogRowToExercise(row: Record<string, unknown>): CatalogExerciseForProgram {
  const mt = row.measurement_type
  const measurement_type: "reps" | "duration" = mt === "duration" ? "duration" : "reps"
  const rawDur = row.default_duration_seconds
  let default_duration_seconds: number | null = null
  if (rawDur != null && rawDur !== "") {
    const n = Number(rawDur)
    default_duration_seconds = Number.isFinite(n) ? n : null
  }
  return {
    id: String(row.id),
    name: String(row.name),
    muscle_group: String(row.muscle_group),
    emoji: row.emoji != null ? String(row.emoji) : null,
    equipment: String(row.equipment),
    measurement_type,
    default_duration_seconds,
  }
}

/**
 * Fetch the catalog rows for a list of exercise UUIDs. RLS scopes the query to
 * the calling user. Returns an error string naming any IDs that did not come
 * back (catalog miss / inaccessible to the user).
 */
export async function fetchExercisesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<{ data: CatalogExerciseForProgram[]; error: string | null }> {
  const unique = [...new Set(ids)]
  const { data, error } = await supabase
    .from("exercises")
    .select(CATALOG_COLUMNS)
    .in("id", unique)

  if (error) return { data: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const mapped = rows.map(catalogRowToExercise)
  if (mapped.length !== unique.length) {
    const found = new Set(mapped.map((e) => e.id))
    const missing = unique.filter((id) => !found.has(id))
    return {
      data: [],
      error: `Unknown or inaccessible exercise_id(s): ${missing.join(", ")}`,
    }
  }
  return { data: mapped, error: null }
}
