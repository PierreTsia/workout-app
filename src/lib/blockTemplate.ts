import {
  DEFAULT_BLOCK_REST_SECONDS,
  DEFAULT_BLOCK_ROUNDS,
} from "@/lib/blockPersistence"
import { resizePerRound } from "@/lib/perRound"
import type { PerRoundCell } from "@/types/database"

export const DEFAULT_AMRAP_CAP_MINUTES = 20
export const DEFAULT_AMRAP_CAP_SECONDS = DEFAULT_AMRAP_CAP_MINUTES * 60

export type BlockTerminationMode = "rounds" | "amrap"

export interface BlockTemplateState {
  mode: BlockTerminationMode
  rounds: number
  cap_seconds: number | null
  rest_seconds: number
  transition_seconds: number
  exercises: { per_round: PerRoundCell[] }[]
}

function keepFirstRound(
  exercises: BlockTemplateState["exercises"],
): BlockTemplateState["exercises"] {
  return exercises.map((ex) => ({
    per_round: ex.per_round.slice(0, 1),
  }))
}

export function templateFingerprint(block: {
  mode: BlockTerminationMode
  cap_seconds: number | null
  exercises: { exercise_id: string; per_round: PerRoundCell[] }[]
}): string {
  const cells = [...block.exercises]
    .sort((a, b) => a.exercise_id.localeCompare(b.exercise_id))
    .map((ex) => {
      const cell = templateCell(ex, 0, block.mode)
      return `${ex.exercise_id}:${cell.amount}:${cell.weight}`
    })
  return `${block.mode}|${block.cap_seconds ?? ""}|${cells.join(",")}`
}

export function templateCell(
  be: { per_round: PerRoundCell[] },
  round: number,
  mode: BlockTerminationMode,
): PerRoundCell {
  const cell = mode === "amrap" ? be.per_round[0] : be.per_round[round]
  return cell ?? { amount: 0, weight: 0 }
}

export function switchBlockMode(
  current: BlockTemplateState,
  nextMode: BlockTerminationMode,
): BlockTemplateState {
  if (current.mode === nextMode) return current

  if (nextMode === "amrap") {
    return {
      mode: "amrap",
      rounds: 1,
      cap_seconds: DEFAULT_AMRAP_CAP_SECONDS,
      rest_seconds: 0,
      transition_seconds: 0,
      exercises: keepFirstRound(current.exercises),
    }
  }

  return {
    mode: "rounds",
    rounds: DEFAULT_BLOCK_ROUNDS,
    cap_seconds: null,
    rest_seconds: DEFAULT_BLOCK_REST_SECONDS,
    transition_seconds: current.transition_seconds,
    exercises: keepFirstRound(current.exercises).map((ex) => ({
      per_round: resizePerRound(ex.per_round, DEFAULT_BLOCK_ROUNDS),
    })),
  }
}
