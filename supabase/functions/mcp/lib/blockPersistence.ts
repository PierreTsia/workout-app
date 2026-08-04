/**
 * Edge port of in-app block insert builders (ADR 0011 / T163).
 * Mirrors `src/lib/blockPersistence.ts` defaults; maps wire `weight_kg` → DB `weight`.
 * No `@/` imports — Deno Edge only.
 */

import type { CatalogExerciseForProgram } from "./programPersistence.ts"
import type {
  ParsedCircuitExercise,
  ParsedExercise,
} from "./createProgramValidation.ts"

export const DEFAULT_BLOCK_ROUNDS = 3
export const DEFAULT_BLOCK_REST_SECONDS = 90
export const DEFAULT_BLOCK_TRANSITION_SECONDS = 0

export interface PerRoundCellDb {
  amount: number
  weight: number
}

export interface ExerciseBlockInsertRow {
  workout_day_id: string
  label: string | null
  rounds: number
  rest_seconds: number
  transition_seconds: number
  sort_order: number
}

export interface BlockExerciseInsertRow {
  exercise_id: string
  name_snapshot: string
  muscle_snapshot: string
  emoji_snapshot: string
  position: number
  per_round: PerRoundCellDb[]
}

function cellsForNested(
  nested: ParsedCircuitExercise,
  rounds: number,
): PerRoundCellDb[] {
  if (nested.mode === "per_round") {
    return nested.perRound.map((c) => ({ amount: c.amount, weight: c.weightKg }))
  }
  return Array.from({ length: rounds }, () => ({
    amount: nested.amount,
    weight: nested.weightKg,
  }))
}

/**
 * Build insert rows for one parsed Circuit against a catalog map.
 */
export function buildCircuitInsertRows(
  dayId: string,
  sortOrder: number,
  circuit: Extract<ParsedExercise, { kind: "circuit" }>,
  catalogById: Map<string, CatalogExerciseForProgram>,
): { block: ExerciseBlockInsertRow; blockExercises: BlockExerciseInsertRow[] } {
  const block: ExerciseBlockInsertRow = {
    workout_day_id: dayId,
    label: circuit.label,
    rounds: circuit.rounds,
    rest_seconds: circuit.restSeconds,
    transition_seconds: circuit.transitionSeconds,
    sort_order: sortOrder,
  }

  const blockExercises: BlockExerciseInsertRow[] = circuit.exercises.map((nested, position) => {
    const ex = catalogById.get(nested.exerciseId)
    if (!ex) {
      throw new Error(
        `buildCircuitInsertRows: missing catalog row for ${nested.exerciseId}`,
      )
    }
    return {
      exercise_id: nested.exerciseId,
      name_snapshot: ex.name,
      muscle_snapshot: ex.muscle_group,
      emoji_snapshot: ex.emoji ?? "🏋️",
      position,
      per_round: cellsForNested(nested, circuit.rounds),
    }
  })

  return { block, blockExercises }
}
