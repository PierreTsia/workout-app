/**
 * Shared exercise-catalog lookup for the MCP write tools (`create_program`,
 * `update_program`). Single batched `IN (...)` fetch — no per-id round-trip.
 *
 * Extracted from the inline `fetchExercisesByIds` previously private to
 * `tools/createProgram.ts` (T77). Behaviour is preserved verbatim.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"
import type { BenchmarkCircuitLookup, BenchmarkRx } from "./resolveBenchmark.ts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function parseBenchmarkRx(raw: unknown): BenchmarkRx | null {
  if (!isRecord(raw)) return null
  if (raw.mode !== "amrap" && raw.mode !== "rounds") return null
  const cap = raw.cap_seconds
  if (cap !== null && cap !== undefined && (typeof cap !== "number" || !Number.isFinite(cap))) {
    return null
  }
  if (!Array.isArray(raw.exercises)) return null
  const exercises = raw.exercises.flatMap((ex) => {
    if (!isRecord(ex) || typeof ex.exercise_id !== "string") return []
    if (typeof ex.amount !== "number" || typeof ex.weight !== "number") return []
    return [{ exercise_id: ex.exercise_id, amount: ex.amount, weight: ex.weight }]
  })
  if (exercises.length !== raw.exercises.length) return null
  return {
    mode: raw.mode,
    cap_seconds: typeof cap === "number" ? cap : null,
    exercises,
  }
}

function parseBenchmarkRow(raw: unknown): BenchmarkCircuitLookup | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null
  const rx = parseBenchmarkRx(raw.rx)
  if (!rx) return null
  const aliases = Array.isArray(raw.aliases)
    ? raw.aliases.filter((a): a is string => typeof a === "string")
    : []
  return {
    id: raw.id,
    slug: typeof raw.slug === "string" ? raw.slug : null,
    aliases,
    rx,
  }
}

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
  // Short-circuit: PostgREST `.in("id", [])` can error or return unexpected
  // results, and `update_program` legitimately calls this helper with an empty
  // union for rename-only patches on programs that happen to have zero
  // exercises. Skip the round-trip entirely.
  if (unique.length === 0) {
    return { data: [], error: null }
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

/**
 * Fetch Benchmark Circuits visible to the caller (GymLogic seeds + own forks).
 * RLS: `owner_id IS NULL OR owner_id = auth.uid()`.
 */
export async function fetchBenchmarkCircuits(
  supabase: SupabaseClient,
): Promise<{ data: BenchmarkCircuitLookup[]; error: string | null }> {
  const { data, error } = await supabase
    .from("benchmark_circuits")
    .select("id, slug, aliases, rx")

  if (error) return { data: [], error: error.message }
  const rows = Array.isArray(data) ? data.flatMap((row) => {
    const parsed = parseBenchmarkRow(row)
    return parsed ? [parsed] : []
  }) : []
  return { data: rows, error: null }
}
