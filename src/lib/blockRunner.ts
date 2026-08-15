/**
 * Pure state machine for executing an Exercise Block round-by-round (#351,
 * T141). Owns only the cursor, phase and timer deadlines — NOT what's logged.
 * "Logged or not" is derived from `set_logs` (React Query), so going back /
 * cancelling a log is a delete + invalidation, never reducer state.
 */

import { blockCellKey, blockSetNumber } from "@/lib/blockSetLog"

export interface Cursor {
  round: number
  exerciseIdx: number
}

export type RunnerState =
  | { phase: "exercise"; cursor: Cursor }
  | { phase: "transition"; cursor: Cursor; next: Cursor; endsAt: number }
  | { phase: "roundRest"; cursor: Cursor; next: Cursor; endsAt: number }
  | { phase: "leftover"; cursor: Cursor }
  | { phase: "done"; lastLogged?: Cursor }

export type RunnerEvent =
  | { type: "LOG_AND_ADVANCE" }
  | { type: "TIMER_DONE" }
  | { type: "SKIP" }
  | { type: "GO_BACK" }
  | { type: "GO_TO"; cursor: Cursor }
  | { type: "CANCEL_LOG"; cursor?: Cursor }
  | { type: "TIME" }
  | { type: "TERMINATE" }

export interface BlockRunnerContext {
  rounds: number
  exerciseCount: number
  transitionSeconds: number
  restSeconds: number
  mode: "rounds" | "amrap"
}

export function initialRunnerState(): RunnerState {
  return { phase: "exercise", cursor: { round: 0, exerciseIdx: 0 } }
}

/**
 * Rebuild runner state from persisted + queued logs. Kill-app hydrate must
 * not dispatch `GO_TO` (typed, unhandled). Cursor is the first empty cell.
 */
export function runnerStateFromLogs(
  loggedCells: Set<string>,
  exerciseIds: string[],
  options: { finished?: boolean } = {},
): RunnerState {
  if (exerciseIds.length === 0) return initialRunnerState()

  const emptyAt = (round: number): Cursor | null => {
    const exerciseIdx = exerciseIds.findIndex(
      (id) => !loggedCells.has(blockCellKey(id, blockSetNumber(round))),
    )
    return exerciseIdx === -1 ? null : { round, exerciseIdx }
  }
  const firstEmpty = (round: number): Cursor =>
    emptyAt(round) ?? firstEmpty(round + 1)
  const cursor = firstEmpty(0)

  if (options.finished) {
    return {
      phase: "done",
      lastLogged: previousCursor(cursor, exerciseIds.length),
    }
  }

  return { phase: "exercise", cursor }
}

/**
 * Move from `cursor` to `next`, arming a timer phase when `seconds > 0`,
 * otherwise jumping straight to the next exercise.
 */
function advanceTo(
  phase: "transition" | "roundRest",
  cursor: Cursor,
  next: Cursor,
  now: number,
  seconds: number,
): RunnerState {
  if (seconds > 0) {
    return { phase, cursor, next, endsAt: now + seconds * 1000 }
  }
  return { phase: "exercise", cursor: next }
}

/** The cell before `cursor`, stepping across round boundaries; clamps at the first cell. */
function previousCursor(cursor: Cursor, exerciseCount: number): Cursor {
  if (cursor.exerciseIdx > 0) {
    return { round: cursor.round, exerciseIdx: cursor.exerciseIdx - 1 }
  }
  if (cursor.round > 0) {
    return { round: cursor.round - 1, exerciseIdx: exerciseCount - 1 }
  }
  return cursor
}

export function blockRunnerReducer(
  state: RunnerState,
  event: RunnerEvent,
  ctx: BlockRunnerContext,
  now: number,
): RunnerState {
  switch (event.type) {
    case "LOG_AND_ADVANCE": {
      if (state.phase === "leftover") {
        return { phase: "done", lastLogged: state.cursor }
      }
      if (state.phase !== "exercise") return state
      const { round, exerciseIdx } = state.cursor
      if (exerciseIdx < ctx.exerciseCount - 1) {
        const next: Cursor = { round, exerciseIdx: exerciseIdx + 1 }
        return advanceTo("transition", state.cursor, next, now, ctx.transitionSeconds)
      }
      if (ctx.mode === "amrap" || round < ctx.rounds - 1) {
        const next: Cursor = { round: round + 1, exerciseIdx: 0 }
        return advanceTo("roundRest", state.cursor, next, now, ctx.restSeconds)
      }
      return { phase: "done" }
    }
    case "TIMER_DONE":
    case "SKIP": {
      if (state.phase !== "transition" && state.phase !== "roundRest") {
        return state
      }
      return { phase: "exercise", cursor: state.next }
    }
    case "GO_BACK": {
      if (state.phase === "transition" || state.phase === "roundRest") {
        // cancel the timer, return to the exercise just logged
        return { phase: "exercise", cursor: state.cursor }
      }
      const cursor =
        state.phase === "done"
          ? (state.lastLogged ?? {
              round: ctx.rounds - 1,
              exerciseIdx: ctx.exerciseCount - 1,
            })
          : previousCursor(state.cursor, ctx.exerciseCount)
      return { phase: "exercise", cursor }
    }
    case "CANCEL_LOG":
      // Navigation-neutral by design: the actual delete of the set_logs row is
      // a side effect handled by the hook layer. Cursor stays put (T141
      // decision); jumping to the cancelled cell would be a T142 change.
      return state
    case "TIME":
    case "TERMINATE": {
      if (state.phase !== "exercise") return state
      return { phase: "leftover", cursor: state.cursor }
    }
    default:
      return state
  }
}
