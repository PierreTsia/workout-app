/**
 * Pure state machine for executing an Exercise Block round-by-round (#351,
 * T141). Owns only the cursor, phase and timer deadlines — NOT what's logged.
 * "Logged or not" is derived from `set_logs` (React Query), so going back /
 * cancelling a log is a delete + invalidation, never reducer state.
 */

export interface Cursor {
  round: number
  exerciseIdx: number
}

export type RunnerState =
  | { phase: "exercise"; cursor: Cursor }
  | { phase: "transition"; cursor: Cursor; next: Cursor; endsAt: number }
  | { phase: "roundRest"; cursor: Cursor; next: Cursor; endsAt: number }
  | { phase: "done" }

export type RunnerEvent =
  | { type: "LOG_AND_ADVANCE" }
  | { type: "TIMER_DONE" }
  | { type: "SKIP" }
  | { type: "GO_BACK" }
  | { type: "GO_TO"; cursor: Cursor }
  | { type: "CANCEL_LOG"; cursor?: Cursor }

export interface BlockRunnerContext {
  rounds: number
  exerciseCount: number
  transitionSeconds: number
  restSeconds: number
}

export function initialRunnerState(): RunnerState {
  return { phase: "exercise", cursor: { round: 0, exerciseIdx: 0 } }
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
function previousCursor(cursor: Cursor, ctx: BlockRunnerContext): Cursor {
  if (cursor.exerciseIdx > 0) {
    return { round: cursor.round, exerciseIdx: cursor.exerciseIdx - 1 }
  }
  if (cursor.round > 0) {
    return { round: cursor.round - 1, exerciseIdx: ctx.exerciseCount - 1 }
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
      if (state.phase !== "exercise") return state
      const { round, exerciseIdx } = state.cursor
      if (exerciseIdx < ctx.exerciseCount - 1) {
        const next: Cursor = { round, exerciseIdx: exerciseIdx + 1 }
        return advanceTo("transition", state.cursor, next, now, ctx.transitionSeconds)
      }
      if (round < ctx.rounds - 1) {
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
          ? { round: ctx.rounds - 1, exerciseIdx: ctx.exerciseCount - 1 }
          : previousCursor(state.cursor, ctx)
      return { phase: "exercise", cursor }
    }
    case "CANCEL_LOG":
      // Navigation-neutral by design: the actual delete of the set_logs row is
      // a side effect handled by the hook layer. Cursor stays put (T141
      // decision); jumping to the cancelled cell would be a T142 change.
      return state
    default:
      return state
  }
}
