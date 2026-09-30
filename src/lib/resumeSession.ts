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
): SessionSetRow {
  if (log.duration_seconds != null) {
    return {
      kind: "duration",
      targetSeconds: resolveTargetSecondsForRow(exercise, lib),
      weight: String(log.weight_logged),
      done: true,
      rir: log.rir ?? undefined,
      timerStartedAt: null,
      loggedSeconds: log.duration_seconds,
    }
  }
  return {
    kind: "reps",
    reps: log.reps_logged ?? "",
    weight: String(log.weight_logged),
    done: true,
    rir: log.rir ?? undefined,
  }
}

/**
 * Rebuild `setsData` rows for the solo slots that already have persisted logs,
 * so a resumed session shows them as done instead of fresh. Slots with no logs
 * are omitted (the existing effect builds their fresh rows); block logs are
 * ignored (circuits are tracked through `completedBlockIds`).
 */
export function hydrateSetsDataFromLogs(
  exercises: WorkoutExercise[],
  logs: SetLog[],
  library: Map<string, ExerciseListItem>,
): Record<string, SessionSetRow[]> {
  const logsBySlot = groupBy(
    logs.filter((log) => log.workout_exercise_id != null),
    (log) => log.workout_exercise_id as string,
  )

  return Object.fromEntries(
    exercises.flatMap((exercise) => {
      const slotLogs = logsBySlot.get(exercise.id)
      if (!slotLogs || slotLogs.length === 0) return []
      const lib = library.get(exercise.exercise_id)
      const rows = [...slotLogs]
        .sort((a, b) => a.set_number - b.set_number)
        .map((log) => toSessionSetRow(log, exercise, lib))
      return [[exercise.id, rows] as const]
    }),
  )
}

/** Ids of the block runs that were finished (best-effort circuit resume). */
export function completedBlockIdsFromRuns(runs: BlockRunRow[]): string[] {
  return runs
    .filter((run) => run.finished_at != null)
    .map((run) => run.block_id)
}
