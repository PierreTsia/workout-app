/**
 * Assembles per-query resolution results from the flat row stream returned by
 * the `resolve_exercises_batch` Postgres RPC (see
 * `supabase/migrations/20260506000736_resolve_exercises_batch.sql`).
 *
 * Pure function — input: original queries + RPC rows; output: one
 * ResolvedQuery per input position, in input order, with status verdict.
 *
 * Status verdict (per-query):
 *   - "empty_query"  → query was whitespace/empty (RPC skipped it)
 *   - "no_match"     → RPC returned zero rows
 *   - "ambiguous"    → top-2 score gap is below threshold (see lib/scoreGap.ts)
 *   - "matched"      → otherwise (single match OR clear winner)
 *
 * `weight_convention` is derived from `equipment` via formatWeightConvention
 * (see `lib/format.ts`) — it is NOT a column on the exercises table.
 */

import { isAmbiguous } from "./scoreGap.ts"
import { formatWeightConvention, type WeightConvention } from "./format.ts"

export type ResolutionStatus = "matched" | "ambiguous" | "no_match" | "empty_query"

export interface ResolveBatchRow {
  query_idx: number
  query_text: string
  exercise_id: string
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
  measurement_type: string
  default_duration_seconds: number | null
  score: number
}

export interface ResolvedExercise {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  equipment: string
  measurement_type: string
  default_duration_seconds: number | null
  weight_convention: WeightConvention
  score: number
}

export interface ResolvedQuery {
  query: string
  status: ResolutionStatus
  matches: ResolvedExercise[]
}

export function assembleResolutionResults(
  queries: string[],
  rows: ResolveBatchRow[],
  gap?: number,
): ResolvedQuery[] {
  return queries.map((query, idx) => {
    if (query.trim().length === 0) {
      return { query, status: "empty_query" as ResolutionStatus, matches: [] }
    }
    const allMatches = rows
      .filter((r) => r.query_idx === idx)
      .map(toResolvedExercise)
    if (allMatches.length === 0) {
      return { query, status: "no_match" as ResolutionStatus, matches: [] }
    }
    const ambiguous = isAmbiguous(allMatches, gap)
    const matches = ambiguous ? allMatches : allMatches.slice(0, 1)
    const status: ResolutionStatus = ambiguous ? "ambiguous" : "matched"
    return { query, status, matches }
  })
}

function toResolvedExercise(row: ResolveBatchRow): ResolvedExercise {
  return {
    id: row.exercise_id,
    name: row.name,
    name_en: row.name_en,
    muscle_group: row.muscle_group,
    equipment: row.equipment,
    measurement_type: row.measurement_type,
    default_duration_seconds: row.default_duration_seconds,
    weight_convention: formatWeightConvention(row.equipment),
    score: row.score,
  }
}
