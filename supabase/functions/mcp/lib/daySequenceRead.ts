/**
 * DB → MCP Circuit wire + Unified Day Sequence merge for read tools (T165 / ADR 0011).
 * Reverse of `blockPersistence` / `daySequence` writes.
 */

import type { ParsedCircuitExercise, ParsedExercise } from "./createProgramValidation.ts"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"

export interface PerRoundCellDb {
  amount: number
  weight: number
}

export interface DbBlockExerciseForRead {
  exercise_id: string
  name_snapshot: string
  position: number
  per_round: PerRoundCellDb[]
  exercises: { name: string; name_en: string | null } | null
}

export interface DbBlockForRead {
  id: string
  label: string | null
  rounds: number
  rest_seconds: number
  transition_seconds: number
  sort_order: number
  block_exercises: DbBlockExerciseForRead[]
  /** Present after T183; omitted on older fixtures → Tours. */
  mode?: "rounds" | "amrap"
  cap_seconds?: number | null
}

export interface DbSoloForRead {
  id?: string
  exercise_id: string
  name_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
  sort_order: number
  name?: string | null
  name_en?: string | null
}

export type CircuitWireExercise =
  | { exercise_id: string; amount: number; weight_kg: number }
  | { exercise_id: string; per_round: { amount: number; weight_kg: number }[] }

export interface CircuitWireItem {
  type: "circuit"
  label?: string
  mode?: "rounds" | "amrap"
  cap_minutes?: number
  rounds?: number
  rest_seconds?: number
  transition_seconds?: number
  exercises: CircuitWireExercise[]
}

function cellsAreHomogeneous(cells: PerRoundCellDb[]): boolean {
  if (cells.length === 0) return true
  const [first, ...rest] = cells
  return rest.every((c) => c.amount === first.amount && c.weight === first.weight)
}

/**
 * Map a persisted Exercise Block to ParsedExercise for markdown (formatCircuitPreviewLines).
 * Homogeneous cells → flat mode; heterogeneous → per_round mode.
 */
export function dbBlockToParsedCircuit(
  block: DbBlockForRead,
): Extract<ParsedExercise, { kind: "circuit" }> {
  const exercises: ParsedCircuitExercise[] = [...block.block_exercises]
    .sort((a, b) => a.position - b.position)
    .map((be) => {
      if (cellsAreHomogeneous(be.per_round) && be.per_round.length > 0) {
        const cell = be.per_round[0]
        return {
          mode: "flat" as const,
          exerciseId: be.exercise_id,
          amount: cell.amount,
          weightKg: cell.weight,
        }
      }
      return {
        mode: "per_round" as const,
        exerciseId: be.exercise_id,
        perRound: be.per_round.map((c) => ({
          amount: c.amount,
          weightKg: c.weight,
        })),
      }
    })

  const isAmrap = block.mode === "amrap"
  const capMinutes =
    isAmrap && block.cap_seconds != null ? block.cap_seconds / 60 : null

  return {
    kind: "circuit",
    label: block.label?.trim() ? block.label.trim() : null,
    rounds: isAmrap ? 1 : block.rounds,
    restSeconds: isAmrap ? 0 : block.rest_seconds,
    transitionSeconds: isAmrap ? 0 : block.transition_seconds,
    exercises,
    mode: isAmrap ? "amrap" : "rounds",
    capMinutes,
  }
}

/**
 * Map a persisted Exercise Block to an MCP Circuit Item (echo-ready for update_program).
 * Homogeneous `per_round` collapses to flat `{amount, weight_kg}`.
 */
export function dbBlockToCircuitWire(block: DbBlockForRead): CircuitWireItem {
  const nested = [...block.block_exercises]
    .sort((a, b) => a.position - b.position)
    .map((be): CircuitWireExercise => {
      if (cellsAreHomogeneous(be.per_round) && be.per_round.length > 0) {
        const cell = be.per_round[0]
        return {
          exercise_id: be.exercise_id,
          amount: cell.amount,
          weight_kg: cell.weight,
        }
      }
      return {
        exercise_id: be.exercise_id,
        per_round: be.per_round.map((c) => ({
          amount: c.amount,
          weight_kg: c.weight,
        })),
      }
    })

  const label = block.label?.trim()
  if (block.mode === "amrap") {
    const capMinutes = (block.cap_seconds ?? 0) / 60
    return {
      type: "circuit",
      ...(label ? { label } : {}),
      mode: "amrap",
      cap_minutes: capMinutes,
      exercises: nested,
    }
  }

  const wire: CircuitWireItem = {
    type: "circuit",
    rounds: block.rounds,
    rest_seconds: block.rest_seconds,
    transition_seconds: block.transition_seconds,
    exercises: nested,
  }
  if (label) wire.label = label
  return wire
}

export type DaySequenceReadItem =
  | { kind: "solo"; sort_order: number; solo: DbSoloForRead }
  | { kind: "circuit"; sort_order: number; block: DbBlockForRead }

/** Merge solos + blocks into one Unified Day Sequence (shared sort_order namespace). */
export function mergeDaySequence(
  solos: DbSoloForRead[],
  blocks: DbBlockForRead[],
): DaySequenceReadItem[] {
  const soloItems: DaySequenceReadItem[] = solos.map((solo) => ({
    kind: "solo",
    sort_order: solo.sort_order,
    solo,
  }))
  const circuitItems: DaySequenceReadItem[] = blocks.map((block) => ({
    kind: "circuit",
    sort_order: block.sort_order,
    block: {
      ...block,
      block_exercises: [...block.block_exercises].sort((a, b) => a.position - b.position),
    },
  }))
  return [...soloItems, ...circuitItems].sort((a, b) => a.sort_order - b.sort_order)
}

export type SoloWireItem = {
  exercise_id: string
  sets: number
  reps: string
  weight_kg: number
  rest_seconds: number
  target_duration_seconds?: number
}

export type EchoDayExercise = string | SoloWireItem | CircuitWireItem

/** Patch-shaped `days[].exercises` for the get_program_details JSON fence. */
export function daySequenceToEchoExercises(items: DaySequenceReadItem[]): EchoDayExercise[] {
  return items.map((item) => {
    if (item.kind === "circuit") return dbBlockToCircuitWire(item.block)
    const solo = item.solo
    const wire: SoloWireItem = {
      exercise_id: solo.exercise_id,
      sets: solo.sets,
      reps: solo.reps,
      weight_kg: Number(solo.weight),
      rest_seconds: solo.rest_seconds,
    }
    if (solo.target_duration_seconds != null) {
      wire.target_duration_seconds = solo.target_duration_seconds
    }
    return wire
  })
}

/** Catalog-ish map for formatCircuitPreviewLines from a DB block embed. */
export function catalogMapFromBlock(
  block: DbBlockForRead,
): Map<string, CatalogExerciseForProgram> {
  return new Map(
    block.block_exercises.map((be) => {
      const name = be.exercises?.name ?? be.name_snapshot
      const row: CatalogExerciseForProgram = {
        id: be.exercise_id,
        name,
        muscle_group: "",
        emoji: null,
        equipment: "other",
        measurement_type: "reps",
        default_duration_seconds: null,
      }
      return [be.exercise_id, row] as const
    }),
  )
}
