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
 *
 * Apply strategy (ADR 0030): **in-place reconciliation**, not wipe + reinsert.
 * Incoming day items are matched to the existing slots of the day so the
 * `workout_exercises.id` / `exercise_blocks.id` survive an edit — preserving
 * `set_logs.workout_exercise_id` / `block_runs.block_id` (both
 * `ON DELETE SET NULL`). Unmatched incoming → INSERT; leftover existing →
 * DELETE.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import type { ParsedExercise } from "./createProgramValidation.ts"
import {
  buildCircuitInsertRows,
  type BlockExerciseInsertRow,
} from "./blockPersistence.ts"
import { buildGeneratedExercise } from "./exerciseConversion.ts"
import {
  buildWorkoutExerciseInsertRowsForDay,
  type CatalogExerciseForProgram,
} from "./programPersistence.ts"
import { matchByKey, reconcileBlocks, reconcileSolos } from "./slotReconciliation.ts"

interface ExistingSoloRow {
  id: string
  exercise_id: string
  sort_order: number
}

interface ExistingBlockRow {
  id: string
  benchmark_circuit_id: string | null
  sort_order: number
}

interface ExistingBlockCellRow {
  id: string
  exercise_id: string
  position: number
}

/** All catalog UUIDs referenced by solos or nested Circuit exercises. */
export function collectParsedCatalogIds(items: ParsedExercise[]): string[] {
  return items.flatMap((p) => {
    if (p.kind === "circuit") {
      return p.exercises.map((e) => e.exerciseId)
    }
    return [p.exerciseId]
  })
}

function bySortOrder<T extends { sort_order: number }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * Reconcile a matched block's nested cells in place, preserving
 * `block_exercises.id` (and therefore `set_logs.block_exercise_id`).
 */
async function reconcileBlockCells(
  supabase: SupabaseClient,
  blockId: string,
  incoming: BlockExerciseInsertRow[],
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("block_exercises")
    .select("id, exercise_id, position")
    .eq("block_id", blockId)
    .order("position")
  if (error) return { error: error.message }

  // Duplicate `exercise_id`s are allowed (ADR 0011). `ORDER BY position` makes
  // the greedy match pair each incoming occurrence with the existing cell at the
  // same position, so a duplicate's id — and its `set_logs.block_exercise_id`
  // history — never lands on the wrong occurrence.
  const existing = (data ?? []) as ExistingBlockCellRow[]
  const plan = matchByKey(
    existing,
    incoming,
    (row) => row.exercise_id,
    (cell) => cell.exercise_id,
  )

  for (const { existing: cell, incoming: next } of plan.matched) {
    const { error: updateErr } = await supabase
      .from("block_exercises")
      .update(next)
      .eq("id", cell.id)
    if (updateErr) return { error: updateErr.message }
  }

  if (plan.inserted.length > 0) {
    const rows = plan.inserted.map(({ incoming: cell }) => ({ ...cell, block_id: blockId }))
    const { error: insertErr } = await supabase.from("block_exercises").insert(rows)
    if (insertErr) return { error: insertErr.message }
  }

  if (plan.deleted.length > 0) {
    const { error: deleteErr } = await supabase
      .from("block_exercises")
      .delete()
      .in("id", plan.deleted.map((row) => row.id))
    if (deleteErr) return { error: deleteErr.message }
  }

  return { error: null }
}

/**
 * Reconcile the Unified Day Sequence for a single day (solos + Circuits) in
 * place. Pre-flight: every catalog id (incl. nested Circuit exercises) must be
 * present before any write — we never delete rows we cannot reinsert.
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

  const { data: soloRows, error: soloFetchErr } = await supabase
    .from("workout_exercises")
    .select("id, exercise_id, sort_order")
    .eq("workout_day_id", dayId)
  if (soloFetchErr) return { ok: false, error: soloFetchErr.message }

  const { data: blockRows, error: blockFetchErr } = await supabase
    .from("exercise_blocks")
    .select("id, benchmark_circuit_id, sort_order")
    .eq("workout_day_id", dayId)
  if (blockFetchErr) return { ok: false, error: blockFetchErr.message }

  const soloPlan = reconcileSolos(
    bySortOrder((soloRows ?? []) as ExistingSoloRow[]),
    parsedExercises,
  )
  const blockPlan = reconcileBlocks(
    bySortOrder((blockRows ?? []) as ExistingBlockRow[]),
    parsedExercises,
  )

  // --- Solos ---------------------------------------------------------------
  for (const { existing, incoming, index } of soloPlan.matched) {
    const generated = buildGeneratedExercise(incoming, catalogById.get(incoming.exerciseId)!)
    const [row] = buildWorkoutExerciseInsertRowsForDay(dayId, [generated])
    // A matched solo keeps its identity: write the prescription and its
    // snapshots only. The derived/config columns (ranges, max_weight_reached,
    // duration ranges) are Builder-owned and must survive an MCP edit.
    const {
      workout_day_id: _dayId,
      rep_range_min: _repRangeMin,
      rep_range_max: _repRangeMax,
      set_range_min: _setRangeMin,
      set_range_max: _setRangeMax,
      max_weight_reached: _maxWeightReached,
      duration_range_min_seconds: _durationRangeMin,
      duration_range_max_seconds: _durationRangeMax,
      duration_increment_seconds: _durationIncrement,
      ...prescription
    } = row
    const { error } = await supabase
      .from("workout_exercises")
      .update({ ...prescription, sort_order: index })
      .eq("id", existing.id)
    if (error) return { ok: false, error: error.message }
  }

  if (soloPlan.inserted.length > 0) {
    const rows = soloPlan.inserted.map(({ incoming, index }) => {
      const generated = buildGeneratedExercise(incoming, catalogById.get(incoming.exerciseId)!)
      const [row] = buildWorkoutExerciseInsertRowsForDay(dayId, [generated])
      return { ...row, sort_order: index }
    })
    const { error } = await supabase.from("workout_exercises").insert(rows)
    if (error) return { ok: false, error: error.message }
  }

  if (soloPlan.deleted.length > 0) {
    const { error } = await supabase
      .from("workout_exercises")
      .delete()
      .in("id", soloPlan.deleted.map((row) => row.id))
    if (error) return { ok: false, error: error.message }
  }

  // --- Blocks --------------------------------------------------------------
  for (const { existing, incoming, index } of blockPlan.matched) {
    const { block, blockExercises } = buildCircuitInsertRows(dayId, index, incoming, catalogById)
    const { workout_day_id, ...fields } = block
    const { error } = await supabase
      .from("exercise_blocks")
      .update(fields)
      .eq("id", existing.id)
    if (error) return { ok: false, error: error.message }

    const cellResult = await reconcileBlockCells(supabase, existing.id, blockExercises)
    if (cellResult.error) return { ok: false, error: cellResult.error }
  }

  for (const { incoming, index } of blockPlan.inserted) {
    const { block, blockExercises } = buildCircuitInsertRows(dayId, index, incoming, catalogById)
    const { data: created, error: blockError } = await supabase
      .from("exercise_blocks")
      .insert(block)
      .select("id")
      .single()
    if (blockError || !created?.id) {
      return { ok: false, error: blockError?.message ?? "exercise_blocks insert returned no id" }
    }
    const rows = blockExercises.map((be) => ({ ...be, block_id: created.id }))
    const { error: beErr } = await supabase.from("block_exercises").insert(rows)
    if (beErr) return { ok: false, error: beErr.message }
  }

  if (blockPlan.deleted.length > 0) {
    const { error } = await supabase
      .from("exercise_blocks")
      .delete()
      .in("id", blockPlan.deleted.map((row) => row.id))
    if (error) return { ok: false, error: error.message }
  }

  return { ok: true, inserted_count: parsedExercises.length }
}
