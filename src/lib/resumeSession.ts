import { getDefaultStore } from "jotai"
import { defaultSessionState, sessionAtom } from "@/store/atoms"
import { seedSessionMeta } from "@/lib/syncService"
import { groupBy } from "@/lib/utils"
import {
  resolveTargetSecondsForRow,
  type SessionSetRow,
} from "@/lib/sessionSetRow"
import type {
  ExerciseListItem,
  SetLog,
  WorkoutExercise,
} from "@/types/database"

const store = getDefaultStore()

/** The subset of a `sessions` row the resume path needs. */
export interface OrphanSession {
  id: string
  workout_day_id: string | null
  workout_label_snapshot: string
  started_at: string
  cycle_id: string | null
}

/** A `block_runs` row, narrowed to the fields that decide completion. */
export interface BlockRunRow {
  block_id: string
  finished_at: string | null
}

/**
 * Reopen an orphan session locally (#571): point the local session id at the
 * orphan's real row, then activate `sessionAtom` on its workout day. The caller
 * hydrates `setsData` from the persisted logs once they load.
 */
export function resumeOrphanSession(
  orphan: OrphanSession,
  userId: string,
): void {
  const startedAt = new Date(orphan.started_at).getTime()

  seedSessionMeta(userId, `local-${startedAt}`, {
    realId: orphan.id,
    workoutDayId: orphan.workout_day_id,
    workoutLabelSnapshot: orphan.workout_label_snapshot,
    startedAt,
  })

  store.set(sessionAtom, {
    ...defaultSessionState,
    isActive: true,
    startedAt,
    currentDayId: orphan.workout_day_id,
    activeDayId: orphan.workout_day_id,
    cycleId: orphan.cycle_id,
  })
}

function toSessionSetRow(
  log: SetLog,
  exercise: WorkoutExercise,
  lib: ExerciseListItem | undefined,
  toDisplay: (kg: number) => number,
): SessionSetRow {
  // `weight_logged` is persisted in kg; `setsData` stores display-unit values
  // (`SetsTable` converts them back with `toKg`), so convert here.
  const weight = String(
    Math.round(toDisplay(log.weight_logged ?? 0) * 10) / 10,
  )
  if (log.duration_seconds != null) {
    return {
      kind: "duration",
      targetSeconds: resolveTargetSecondsForRow(exercise, lib),
      weight,
      done: true,
      rir: log.rir ?? undefined,
      timerStartedAt: null,
      loggedSeconds: log.duration_seconds,
    }
  }
  return {
    kind: "reps",
    reps: log.reps_logged ?? "",
    weight,
    done: true,
    rir: log.rir ?? undefined,
  }
}

/**
 * Log-derived rows keyed by slot id, then set index (`set_number - 1`). The
 * caller overlays them onto the slot's prescribed rows rather than replacing
 * them — sets that were prescribed but never logged stay put. Slots with no
 * logs are omitted; block logs are ignored (circuits are tracked through
 * `completedBlockIds`).
 */
export function hydrateSetsDataFromLogs(
  exercises: WorkoutExercise[],
  logs: SetLog[],
  library: Map<string, ExerciseListItem>,
  toDisplay: (kg: number) => number,
): Record<string, Record<number, SessionSetRow>> {
  const logsBySlot = groupBy(
    logs.filter((log) => log.workout_exercise_id != null),
    (log) => log.workout_exercise_id as string,
  )

  return Object.fromEntries(
    exercises.flatMap((exercise) => {
      const slotLogs = logsBySlot.get(exercise.id)
      if (!slotLogs || slotLogs.length === 0) return []
      const lib = library.get(exercise.exercise_id)
      const byIndex: Record<number, SessionSetRow> = {}
      for (const log of slotLogs) {
        byIndex[Math.max(0, log.set_number - 1)] = toSessionSetRow(
          log,
          exercise,
          lib,
          toDisplay,
        )
      }
      return [[exercise.id, byIndex] as const]
    }),
  )
}

/** Ids of the block runs that were finished (best-effort circuit resume). */
export function completedBlockIdsFromRuns(runs: BlockRunRow[]): string[] {
  return runs
    .filter((run) => run.finished_at != null)
    .map((run) => run.block_id)
}
