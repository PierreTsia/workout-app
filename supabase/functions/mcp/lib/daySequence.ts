/**
 * Unified Day Sequence persistence for MCP writes (T163 / ADR 0011).
 * Insert solos + blocks interleaved by sort_order = array index.
 *
 * Replacing an existing day is handled by `applyDayUpdate`'s in-place
 * reconciliation (ADR 0030), not by a wipe here.
 */

import { buildCircuitInsertRows } from "./blockPersistence.ts"
import { buildGeneratedExercise } from "./exerciseConversion.ts"
import {
  buildWorkoutExerciseInsertRowsForDay,
  type CatalogExerciseForProgram,
} from "./programPersistence.ts"
import type { ParsedExercise } from "./createProgramValidation.ts"
import {
  formatCircuitPreviewLines,
  formatPrescriptionLine,
  formatWeightConvention,
} from "./format.ts"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase chain not typed on the edge vitest surface
type SupabaseLike = { from: (table: string) => any }

/**
 * Insert parsed day items (solos + Circuits) with shared sort_order namespace.
 * Caller must ensure the day is empty (fresh INSERT day) — replacing an
 * existing day goes through `applyDayUpdate`.
 */
export async function insertDaySequence(
  supabase: SupabaseLike,
  dayId: string,
  items: ParsedExercise[],
  catalogById: Map<string, CatalogExerciseForProgram>,
): Promise<{ error: string | null }> {
  // Batch solos into one insert (preserves prior create_* mock/test shape);
  // Circuits need the block id mid-loop so they insert immediately.
  const soloRows: Record<string, unknown>[] = []

  for (const [sortOrder, item] of items.entries()) {
    if (item.kind === "circuit") {
      const { block, blockExercises } = buildCircuitInsertRows(
        dayId,
        sortOrder,
        item,
        catalogById,
      )
      const { data: created, error: blockError } = await supabase
        .from("exercise_blocks")
        .insert(block)
        .select("id")
        .single()
      if (blockError || !created?.id) {
        return { error: blockError?.message ?? "exercise_blocks insert returned no id" }
      }
      const rows = blockExercises.map((be) => ({ ...be, block_id: created.id }))
      const { error: beErr } = await supabase.from("block_exercises").insert(rows)
      if (beErr) return { error: beErr.message }
      continue
    }

    const generated = buildGeneratedExercise(item, catalogById.get(item.exerciseId)!)
    const [row] = buildWorkoutExerciseInsertRowsForDay(dayId, [generated])
    soloRows.push({ ...row, sort_order: sortOrder })
  }

  if (soloRows.length > 0) {
    const { error: soloErr } = await supabase.from("workout_exercises").insert(soloRows)
    if (soloErr) return { error: soloErr.message }
  }
  return { error: null }
}

/**
 * Build dry_run `rendered` lines for a mixed day (solos + Circuits).
 */
export function buildDayRenderedLines(
  items: ParsedExercise[],
  catalogById: Map<string, CatalogExerciseForProgram>,
): string[] {
  return items.flatMap((item) => {
    if (item.kind === "circuit") {
      return formatCircuitPreviewLines(item, catalogById)
    }
    const ge = buildGeneratedExercise(item, catalogById.get(item.exerciseId)!)
    const placeholderDayId = "00000000-0000-4000-8000-000000000000"
    const [row] = buildWorkoutExerciseInsertRowsForDay(placeholderDayId, [ge])
    return [
      formatPrescriptionLine({
        exerciseName: ge.exercise.name,
        sets: row.sets,
        reps: row.reps,
        weightKg: Number(row.weight),
        restSeconds: row.rest_seconds,
        weightConvention: formatWeightConvention(ge.exercise.equipment),
        targetDurationSeconds: row.target_duration_seconds ?? undefined,
      }),
    ]
  })
}
