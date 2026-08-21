import type { SetLogPayload } from "@/lib/syncService"
import {
  templateCell,
  type BlockTerminationMode,
} from "@/lib/blockTemplate"
import {
  computeWasPr,
  getPrModality,
  scoreLiveDurationSet,
  scoreLiveRepSet,
} from "@/lib/prDetection"
import type { BlockExerciseWithExercise, SetLog } from "@/types/database"

/** Block rounds are 0-based internally; set_logs.set_number is 1-based. */
export function blockSetNumber(round: number): number {
  return round + 1
}

/** Identity of a logged block cell — pairs the block exercise with its round's set_number. */
export function blockCellKey(blockExerciseId: string, setNumber: number): string {
  return `${blockExerciseId}#${setNumber}`
}

/** Prior-best inputs mirroring SetsTable's write-time PR gate. */
export type BlockSetPrContext = {
  historicalBest: number
  sessionBest: number
  hasPriorSession: boolean
  historyFetched: boolean
}

interface BuildArgs {
  sessionId: string
  blockExercise: BlockExerciseWithExercise
  /** 0-based round index. */
  round: number
  now: number
  mode?: BlockTerminationMode
  /** Leftover actual (reps or seconds). Prescribed amount when omitted. */
  actual?: number
  /** Omit to stay conservative (`wasPr: false`) until history is in. */
  pr?: BlockSetPrContext
}

/**
 * Build the set_logs payload for one block cell (exercise × round). Block work
 * stays out of the progression engine (ADR 0007): no prescribed_* snapshot,
 * no 1RM / RIR. `was_pr` is the exception — a loaded Circuit station uses the
 * same `prDetection` as solos so it can mint a Profil PR.
 */
export function buildBlockSetLogPayload({
  sessionId,
  blockExercise,
  round,
  now,
  mode,
  actual,
  pr,
}: BuildArgs): SetLogPayload {
  const cell = templateCell(blockExercise, round, mode ?? "rounds")
  const amount = actual ?? cell.amount
  const modality = getPrModality({
    measurement_type: blockExercise.exercise?.measurement_type,
    equipment: blockExercise.exercise?.equipment,
  })
  const currentScore =
    modality === "duration"
      ? scoreLiveDurationSet(amount)
      : scoreLiveRepSet(cell.weight, amount, modality)
  const wasPr = computeWasPr({
    currentScore,
    historicalBest: pr?.historicalBest ?? 0,
    sessionBest: pr?.sessionBest ?? 0,
    hasPriorSession: pr?.hasPriorSession ?? false,
    historyFetched: pr?.historyFetched ?? false,
  })
  const base = {
    sessionId,
    exerciseId: blockExercise.exercise_id,
    blockExerciseId: blockExercise.id,
    exerciseNameSnapshot: blockExercise.name_snapshot,
    setNumber: blockSetNumber(round),
    weightLogged: cell.weight,
    wasPr,
    loggedAt: now,
  }

  if (blockExercise.exercise?.measurement_type === "duration") {
    return { ...base, durationSeconds: amount }
  }
  return { ...base, repsLogged: String(amount), estimatedOneRM: 0 }
}

/** Set of `blockCellKey`s already logged in this session (ignores solo rows). */
export function loggedBlockCells(setLogs: SetLog[]): Set<string> {
  return new Set(
    setLogs
      .filter((log) => log.block_exercise_id != null)
      .map((log) => blockCellKey(log.block_exercise_id!, log.set_number)),
  )
}
