import { blockCellKey } from "@/lib/blockSetLog"
import type { SetLogPayload } from "@/lib/syncService"
import type { SessionSetRow } from "@/lib/sessionSetRow"
import type {
  ExerciseBlockWithExercises,
  SetLog,
  WorkoutExercise,
} from "@/types/database"

export function countSoloSetsDone(
  exercises: WorkoutExercise[],
  setsData: Record<string, SessionSetRow[]>,
): number {
  return exercises
    .flatMap((ex) => setsData[ex.id] ?? [])
    .filter((s) => s.done).length
}

/** Unique block cells logged (persisted + still queued), including partial circuits. */
export function countBlockSetsDone(
  persistedLogs: SetLog[],
  queuedPayloads: SetLogPayload[],
): number {
  const keys = new Set<string>()
  for (const log of persistedLogs) {
    if (log.block_exercise_id != null) {
      keys.add(blockCellKey(log.block_exercise_id, log.set_number))
    }
  }
  for (const payload of queuedPayloads) {
    if (payload.blockExerciseId != null) {
      keys.add(blockCellKey(payload.blockExerciseId, payload.setNumber))
    }
  }
  return keys.size
}

export function countSoloExercisesCompleted(
  exercises: WorkoutExercise[],
  setsData: Record<string, SessionSetRow[]>,
): number {
  return exercises.filter((ex) => {
    const sets = setsData[ex.id] ?? []
    return sets.length > 0 && sets.every((s) => s.done)
  }).length
}

export function countBlocksCompleted(completedBlockIds: ReadonlySet<string>): number {
  return completedBlockIds.size
}

export function countSessionSlots(
  exercises: WorkoutExercise[],
  blocks: ExerciseBlockWithExercises[],
): number {
  return exercises.length + blocks.length
}

/**
 * True when the finish payload should set `sessions.has_skipped_sets`.
 * Solo set rows alone are not enough: an unfinished circuit never appears
 * in `setsData`, so incomplete blocks must count as skipped work too.
 */
export function sessionHasSkippedSets(
  exercises: WorkoutExercise[],
  setsData: Record<string, SessionSetRow[]>,
  incompleteBlockCount: number,
): boolean {
  const hasIncompleteSoloSets = exercises
    .flatMap((ex) => setsData[ex.id] ?? [])
    .some((s) => !s.done)
  return hasIncompleteSoloSets || incompleteBlockCount > 0
}
