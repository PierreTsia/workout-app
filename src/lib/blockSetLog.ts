import type { SetLogPayload } from "@/lib/syncService"
import type { BlockExerciseWithExercise, SetLog } from "@/types/database"

/** Block rounds are 0-based internally; set_logs.set_number is 1-based. */
export function blockSetNumber(round: number): number {
  return round + 1
}

/** Identity of a logged block cell — pairs the block exercise with its round's set_number. */
export function blockCellKey(blockExerciseId: string, setNumber: number): string {
  return `${blockExerciseId}#${setNumber}`
}

interface BuildArgs {
  sessionId: string
  blockExercise: BlockExerciseWithExercise
  /** 0-based round index. */
  round: number
  now: number
}

/**
 * Build the set_logs payload for one block cell (exercise × round). Block work
 * is frozen-prescription and out of the progression engine (ADR 0007): no
 * prescribed_* snapshot, no PR / 1RM / RIR — just the logged actuals tagged
 * with block_exercise_id so it never collides with the solo exercise.
 */
export function buildBlockSetLogPayload({
  sessionId,
  blockExercise,
  round,
  now,
}: BuildArgs): SetLogPayload {
  const cell = blockExercise.per_round[round]
  const base = {
    sessionId,
    exerciseId: blockExercise.exercise_id,
    blockExerciseId: blockExercise.id,
    exerciseNameSnapshot: blockExercise.name_snapshot,
    setNumber: blockSetNumber(round),
    weightLogged: cell.weight,
    wasPr: false,
    loggedAt: now,
  }

  if (blockExercise.exercise?.measurement_type === "duration") {
    return { ...base, durationSeconds: cell.amount }
  }
  return { ...base, repsLogged: String(cell.amount), estimatedOneRM: 0 }
}

/** Set of `blockCellKey`s already logged in this session (ignores solo rows). */
export function loggedBlockCells(setLogs: SetLog[]): Set<string> {
  return new Set(
    setLogs
      .filter((log) => log.block_exercise_id != null)
      .map((log) => blockCellKey(log.block_exercise_id!, log.set_number)),
  )
}
