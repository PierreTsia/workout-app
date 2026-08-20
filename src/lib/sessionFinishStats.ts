import { blockCellKey } from "@/lib/blockSetLog"
import type { SetLogPayload } from "@/lib/syncService"
import type { SessionSetRow } from "@/lib/sessionSetRow"
import type {
  ExerciseBlockWithExercises,
  SetLog,
  WorkoutExercise,
} from "@/types/database"

export type SessionProgressInput = {
  exercises: WorkoutExercise[]
  setsData: Record<string, SessionSetRow[]>
  blocks: ExerciseBlockWithExercises[]
  completedBlockIds: ReadonlySet<string>
  persistedLogs: SetLog[]
  queuedPayloads: SetLogPayload[]
}

export type SessionProgress = {
  setsDone: number
  slotsCompleted: number
  hasSkipped: boolean
  totalSlots: number
}

export function sessionProgress(input: SessionProgressInput): SessionProgress {
  const incompleteBlockCount = input.blocks.filter(
    (b) => !input.completedBlockIds.has(b.id),
  ).length
  return {
    setsDone:
      countSoloSetsDone(input.exercises, input.setsData) +
      countBlockSetsDone(input.persistedLogs, input.queuedPayloads),
    slotsCompleted:
      countSoloExercisesCompleted(input.exercises, input.setsData) +
      input.completedBlockIds.size,
    hasSkipped: sessionHasSkippedSets(
      input.exercises,
      input.setsData,
      incompleteBlockCount,
    ),
    totalSlots: input.exercises.length + input.blocks.length,
  }
}

function countSoloSetsDone(
  exercises: WorkoutExercise[],
  setsData: Record<string, SessionSetRow[]>,
): number {
  return exercises
    .flatMap((ex) => setsData[ex.id] ?? [])
    .filter((s) => s.done).length
}

/** Unique block cells logged (persisted + still queued), including partial circuits. */
function countBlockSetsDone(
  persistedLogs: SetLog[],
  queuedPayloads: SetLogPayload[],
): number {
  const fromLogs = persistedLogs.flatMap((log) =>
    log.block_exercise_id != null
      ? [blockCellKey(log.block_exercise_id, log.set_number)]
      : [],
  )
  const fromQueue = queuedPayloads.flatMap((payload) =>
    payload.blockExerciseId != null
      ? [blockCellKey(payload.blockExerciseId, payload.setNumber)]
      : [],
  )
  return new Set([...fromLogs, ...fromQueue]).size
}

function countSoloExercisesCompleted(
  exercises: WorkoutExercise[],
  setsData: Record<string, SessionSetRow[]>,
): number {
  return exercises.filter((ex) => {
    const sets = setsData[ex.id] ?? []
    return sets.length > 0 && sets.every((s) => s.done)
  }).length
}

function sessionHasSkippedSets(
  exercises: WorkoutExercise[],
  setsData: Record<string, SessionSetRow[]>,
  incompleteBlockCount: number,
): boolean {
  const hasIncompleteSoloSets = exercises
    .flatMap((ex) => setsData[ex.id] ?? [])
    .some((s) => !s.done)
  return hasIncompleteSoloSets || incompleteBlockCount > 0
}
