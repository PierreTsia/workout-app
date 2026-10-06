/**
 * In-place reconciliation of a day's Unified Day Sequence (ADR 0030).
 *
 * `update_program` used to wipe + reinsert every day item, minting new
 * `workout_exercises.id` / `exercise_blocks.id` and detaching
 * `set_logs.workout_exercise_id` / `block_runs.block_id` (both
 * `ON DELETE SET NULL`). This module matches incoming items to the existing
 * rows of the day so the apply path can UPDATE in place, INSERT the unmatched,
 * and DELETE the leftover — preserving slot identity.
 *
 * Pure, side-effect-free: no Supabase import, testable from Vitest and Deno.
 */

import type { ParsedExercise } from "./createProgramValidation.ts"

type SoloParsed = Extract<ParsedExercise, { kind: "bare" | "object" }>
type CircuitParsed = Extract<ParsedExercise, { kind: "circuit" }>

export interface MatchPlan<T, I> {
  matched: Array<{ existing: T; incoming: I; index: number }>
  inserted: Array<{ incoming: I; index: number }>
  deleted: T[]
}

function isCircuit(item: ParsedExercise): item is CircuitParsed {
  return item.kind === "circuit"
}

function isSolo(item: ParsedExercise): item is SoloParsed {
  return item.kind !== "circuit"
}

/**
 * Greedy match of `incoming` to `existing` by a key, in order of appearance.
 * A `null` key never matches. Generic over the row/item shapes so the same
 * rule serves solos, blocks, and nested block cells.
 */
export function matchByKey<T, I>(
  existing: T[],
  incoming: I[],
  keyOfExisting: (row: T) => string | null,
  keyOfIncoming: (item: I) => string | null,
): MatchPlan<T, I> {
  const used = new Set<number>()
  const matched: MatchPlan<T, I>["matched"] = []
  const inserted: MatchPlan<T, I>["inserted"] = []

  incoming.forEach((item, index) => {
    const key = keyOfIncoming(item)
    const idx =
      key === null
        ? -1
        : existing.findIndex((row, i) => !used.has(i) && keyOfExisting(row) === key)
    if (idx >= 0) {
      used.add(idx)
      matched.push({ existing: existing[idx], incoming: item, index })
    } else {
      inserted.push({ incoming: item, index })
    }
  })

  return { matched, inserted, deleted: existing.filter((_, i) => !used.has(i)) }
}

/**
 * Greedy match of incoming solos to existing slots by `exercise_id`, in order
 * of appearance. `index` is the item's position in the full day array (shared
 * sort_order namespace with Circuits).
 */
export function reconcileSolos<T extends { exercise_id: string }>(
  existing: T[],
  items: ParsedExercise[],
): MatchPlan<T, SoloParsed> {
  const used = new Set<number>()
  const matched: MatchPlan<T, SoloParsed>["matched"] = []
  const inserted: MatchPlan<T, SoloParsed>["inserted"] = []

  items.forEach((item, index) => {
    if (!isSolo(item)) return
    const idx = existing.findIndex(
      (row, i) => !used.has(i) && row.exercise_id === item.exerciseId,
    )
    if (idx >= 0) {
      used.add(idx)
      matched.push({ existing: existing[idx], incoming: item, index })
    } else {
      inserted.push({ incoming: item, index })
    }
  })

  return { matched, inserted, deleted: existing.filter((_, i) => !used.has(i)) }
}

/**
 * Match incoming Circuits to existing blocks: first by `benchmark_circuit_id`
 * (a named Circuit keeps identity across reorder), then by order for the rest.
 */
export function reconcileBlocks<T extends { benchmark_circuit_id: string | null }>(
  existing: T[],
  items: ParsedExercise[],
): MatchPlan<T, CircuitParsed> {
  const used = new Set<number>()
  const matched: MatchPlan<T, CircuitParsed>["matched"] = []
  const inserted: MatchPlan<T, CircuitParsed>["inserted"] = []
  const pending: Array<{ incoming: CircuitParsed; index: number }> = []

  items.forEach((item, index) => {
    if (!isCircuit(item)) return
    const benchmarkId = item.benchmarkCircuitId ?? null
    if (benchmarkId !== null) {
      const idx = existing.findIndex(
        (row, i) => !used.has(i) && row.benchmark_circuit_id === benchmarkId,
      )
      if (idx >= 0) {
        used.add(idx)
        matched.push({ existing: existing[idx], incoming: item, index })
        return
      }
    }
    pending.push({ incoming: item, index })
  })

  for (const { incoming, index } of pending) {
    const idx = existing.findIndex((_, i) => !used.has(i))
    if (idx >= 0) {
      used.add(idx)
      matched.push({ existing: existing[idx], incoming, index })
    } else {
      inserted.push({ incoming, index })
    }
  }

  return { matched, inserted, deleted: existing.filter((_, i) => !used.has(i)) }
}

/**
 * The `exercise_id`s of existing slots that the incoming items remove or swap
 * away — i.e. whose history will detach. Used by the `dry_run` warning.
 */
export function detachedSoloExerciseIds(
  existingExerciseIds: string[],
  items: ParsedExercise[],
): string[] {
  const existing = existingExerciseIds.map((exercise_id) => ({ exercise_id }))
  return reconcileSolos(existing, items).deleted.map((row) => row.exercise_id)
}
