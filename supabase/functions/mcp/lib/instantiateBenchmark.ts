/**
 * Edge twin of `src/lib/instantiateBenchmark.ts` (T191 / #398).
 * Keep in lockstep — no `@/` imports.
 */

import type { ExerciseBlockInsertRow, BlockExerciseInsertRow } from "./blockPersistence.ts"
import type { BenchmarkCircuitLookup } from "./resolveBenchmark.ts"

export interface InstantiateExerciseRow {
  id: string
  name: string
  muscle_group: string
  emoji: string | null
}

export interface InstantiateBenchmarkArgs {
  workoutDayId: string
  sortOrder: number
  exerciseById: ReadonlyMap<string, InstantiateExerciseRow>
}

function seedLabel(slug: string | null): string {
  if (slug == null || slug.trim() === "") {
    throw new Error("instantiateBenchmark: catalog row has no slug to derive a label")
  }
  const trimmed = slug.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/**
 * Snapshot a Benchmark Circuit Rx onto a day-scoped Exercise Block.
 * Fails if any rx.exercise_id is missing from the exercise catalog — no half-Cindy.
 */
export function instantiateBenchmark(
  catalog: BenchmarkCircuitLookup,
  { workoutDayId, sortOrder, exerciseById }: InstantiateBenchmarkArgs,
): { block: ExerciseBlockInsertRow; blockExercises: BlockExerciseInsertRow[] } {
  const isAmrap = catalog.rx.mode === "amrap"
  const missing = catalog.rx.exercises
    .map((ex) => ex.exercise_id)
    .filter((id) => !exerciseById.has(id))
  if (missing.length > 0) {
    throw new Error(
      `instantiateBenchmark: missing exercise_id(s) in catalog: ${missing.join(", ")}`,
    )
  }

  const rounds = 1
  const block: ExerciseBlockInsertRow = {
    workout_day_id: workoutDayId,
    label: seedLabel(catalog.slug),
    rounds,
    rest_seconds: isAmrap ? 0 : 90,
    transition_seconds: 0,
    sort_order: sortOrder,
    mode: catalog.rx.mode,
    cap_seconds: isAmrap ? catalog.rx.cap_seconds : null,
    benchmark_circuit_id: catalog.id,
  }

  const blockExercises: BlockExerciseInsertRow[] = catalog.rx.exercises.map((ex, position) => {
    const row = exerciseById.get(ex.exercise_id)
    if (!row) {
      throw new Error(`instantiateBenchmark: missing exercise_id ${ex.exercise_id}`)
    }
    return {
      exercise_id: ex.exercise_id,
      name_snapshot: row.name,
      muscle_snapshot: row.muscle_group,
      emoji_snapshot: row.emoji ?? "🏋️",
      position,
      per_round: Array.from({ length: rounds }, () => ({
        amount: ex.amount,
        weight: ex.weight,
      })),
    }
  })

  return { block, blockExercises }
}
