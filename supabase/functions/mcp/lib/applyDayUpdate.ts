/**
 * Edge-only persistence helpers for `update_program` (T80, Epic C #280).
 *
 * Extracted from `programPersistence.ts` so that file stays types-pure (no
 * `supabase-js` import). The Deno CI typecheck on `lib/*_test.ts` walks every
 * transitive type import; a `SupabaseClient` reference there pulls in the
 * supabase-js declarations, which transitively reference `@types/node` and
 * fail to resolve on the Node-less Deno runner. Keeping the supabase touch
 * here means `format.ts` / `programPersistence.ts` (and their tests) never
 * reach a Node-typed module.
 *
 * Web parity note: this module has no web mirror by design — `update_program`
 * is MCP-only.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import type { ParsedExercise } from "./createProgramValidation.ts"
import { insertDaySequence, wipeDaySequence } from "./daySequence.ts"
import {
  parseRepsBounds,
  type CatalogExerciseForProgram,
  type GeneratedExerciseForProgram,
} from "./programPersistence.ts"

/**
 * Defaults applied to bare-string entries that lack an explicit prescription.
 * Mirror of `createProgram.ts` constants — duplicated intentionally to keep
 * `applyDayUpdate` self-contained on the Edge side.
 */
const APPLY_DEFAULT_SETS = 3
const APPLY_DEFAULT_REPS = "10"
const APPLY_DEFAULT_REST_SECONDS = 90

/**
 * Build the `GeneratedExerciseForProgram` shape for an `update_program` apply
 * step. Mirror of the equivalent helper in `tools/createProgram.ts` —
 * duplicated intentionally to keep the apply pipeline self-contained on the
 * Edge side (no cross-tool import). Throws on catalog miss; callers MUST
 * pre-flight via `catalogById.has(...)`.
 */
/** All catalog UUIDs referenced by solos or nested Circuit exercises. */
export function collectParsedCatalogIds(items: ParsedExercise[]): string[] {
  return items.flatMap((p) => {
    if (p.kind === "circuit") {
      return p.exercises.map((e) => e.exerciseId)
    }
    return [p.exerciseId]
  })
}

export function parsedExerciseToGeneratedForApply(
  parsed: ParsedExercise,
  catalogById: Map<string, CatalogExerciseForProgram>,
): GeneratedExerciseForProgram {
  if (parsed.kind === "circuit") {
    throw new Error("Circuit items must be persisted via daySequence / applyDayUpdate")
  }

  const catalogEx = catalogById.get(parsed.exerciseId)
  if (!catalogEx) {
    throw new Error(`Catalog miss for exercise_id ${parsed.exerciseId}`)
  }

  if (parsed.kind === "bare") {
    const isDuration = catalogEx.measurement_type === "duration"
    return {
      exercise: catalogEx,
      sets: APPLY_DEFAULT_SETS,
      reps: isDuration ? "0" : APPLY_DEFAULT_REPS,
      restSeconds: APPLY_DEFAULT_REST_SECONDS,
      isCompound: false,
    }
  }

  const bounds = parseRepsBounds(parsed.reps)
  return {
    exercise: catalogEx,
    sets: parsed.sets,
    reps: parsed.reps,
    restSeconds: parsed.restSeconds,
    isCompound: false,
    weightKg: parsed.weightKg,
    repRangeMin: bounds.min,
    repRangeMax: bounds.max,
    setRangeMin: parsed.sets,
    setRangeMax: parsed.sets,
    targetDurationSeconds: parsed.targetDurationSeconds ?? undefined,
  }
}

/**
 * Wipe-and-reinsert the Unified Day Sequence for a single day (solos + Circuits).
 * Pre-flight: every catalog id (incl. nested Circuit exercises) must be present
 * before any DELETE — we never wipe rows we cannot reinsert.
 */
export async function applyDayUpdate(
  supabase: SupabaseClient,
  dayId: string,
  parsedExercises: ParsedExercise[],
  catalogById: Map<string, CatalogExerciseForProgram>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string,
): Promise<{ ok: true; inserted_count: number } | { ok: false; error: string }> {
  const missingId = collectParsedCatalogIds(parsedExercises).find((id) => !catalogById.has(id))
  if (missingId) {
    return { ok: false, error: `Catalog miss for exercise_id ${missingId}` }
  }

  const { error: wipeErr } = await wipeDaySequence(supabase, dayId)
  if (wipeErr) return { ok: false, error: wipeErr }

  const { error: insertErr } = await insertDaySequence(
    supabase,
    dayId,
    parsedExercises,
    catalogById,
  )
  if (insertErr) return { ok: false, error: insertErr }

  return { ok: true, inserted_count: parsedExercises.length }
}
