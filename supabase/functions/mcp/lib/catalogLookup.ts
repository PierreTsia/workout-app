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

/** UUID v4 format (case-insensitive). */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  // Short-circuit: PostgREST `.in("id", [])` can error or return unexpected
  // results, and `update_program` legitimately calls this helper with an empty
  // union for rename-only patches on programs that happen to have zero
  // exercises. Skip the round-trip entirely.
  if (unique.length === 0) {
    return { data: [], error: null }
  }

  // Guard: reject IDs that are not valid UUID v4 — this catches agents that
  // fabricate placeholder strings (e.g. "kroc-row-id") after empty search results.
  const malformed = unique.filter((id) => !UUID_V4_RE.test(id))
  if (malformed.length > 0) {
    return {
      data: [],
      error: `Invalid exercise_id format (expected UUID v4): ${malformed.join(", ")}. Use search_exercises to find valid IDs.`,
    }
  }
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
