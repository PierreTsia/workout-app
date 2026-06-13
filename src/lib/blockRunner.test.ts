import { describe, it, expect } from "vitest"
import {
  initialRunnerState,
  blockRunnerReducer,
  type BlockRunnerContext,
  type RunnerEvent,
  type RunnerState,
} from "@/lib/blockRunner"

const ctx = (over: Partial<BlockRunnerContext> = {}): BlockRunnerContext => ({
  rounds: 2,
  exerciseCount: 2,
  transitionSeconds: 0,
  restSeconds: 0,
  ...over,
})

const LOG: RunnerEvent = { type: "LOG_AND_ADVANCE" }

function applyAll(
  c: BlockRunnerContext,
  events: RunnerEvent[],
  now = 0,
): RunnerState {
  return events.reduce(
    (s, e) => blockRunnerReducer(s, e, c, now),
    initialRunnerState(),
  )
}

describe("blockRunnerReducer", () => {
  it("traverses every cell then reaches done when there are no timers", () => {
    const c = ctx() // 2 exercises × 2 rounds, no transition, no rest

    expect(initialRunnerState()).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 0 },
    })
    expect(applyAll(c, [LOG])).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 1 },
    })
    expect(applyAll(c, [LOG, LOG])).toEqual({
      phase: "exercise",
      cursor: { round: 1, exerciseIdx: 0 },
    })
    expect(applyAll(c, [LOG, LOG, LOG])).toEqual({
      phase: "exercise",
      cursor: { round: 1, exerciseIdx: 1 },
    })
    expect(applyAll(c, [LOG, LOG, LOG, LOG])).toEqual({ phase: "done" })
  })

  it("arms a transition timer between exercises within a round when transition_seconds > 0", () => {
    const c = ctx({ transitionSeconds: 20 })
    const now = 1_000

    const state = blockRunnerReducer(initialRunnerState(), LOG, c, now)

    expect(state).toEqual({
      phase: "transition",
      cursor: { round: 0, exerciseIdx: 0 },
      next: { round: 0, exerciseIdx: 1 },
      endsAt: now + 20_000,
    })
  })

  it("lands on the next exercise once the transition timer is done or skipped", () => {
    const c = ctx({ transitionSeconds: 20 })
    const transition = blockRunnerReducer(initialRunnerState(), LOG, c, 1_000)

    const afterDone = blockRunnerReducer(transition, { type: "TIMER_DONE" }, c, 0)
    const afterSkip = blockRunnerReducer(transition, { type: "SKIP" }, c, 0)

    const landed: RunnerState = {
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 1 },
    }
    expect(afterDone).toEqual(landed)
    expect(afterSkip).toEqual(landed)
  })

  it("arms a round rest after the last exercise of a non-final round", () => {
    const c = ctx({ restSeconds: 90 })
    const now = 5_000
    // advance to the last exercise of round 0
    const lastOfRound = blockRunnerReducer(initialRunnerState(), LOG, c, 0)
    expect(lastOfRound).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 1 },
    })

    const state = blockRunnerReducer(lastOfRound, LOG, c, now)

    expect(state).toEqual({
      phase: "roundRest",
      cursor: { round: 0, exerciseIdx: 1 },
      next: { round: 1, exerciseIdx: 0 },
      endsAt: now + 90_000,
    })
  })

  const BACK: RunnerEvent = { type: "GO_BACK" }

  it("steps the cursor back one exercise within a round", () => {
    const c = ctx()
    const atSecond = blockRunnerReducer(initialRunnerState(), LOG, c, 0)

    expect(blockRunnerReducer(atSecond, BACK, c, 0)).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 0 },
    })
  })

  it("steps back across a round boundary to the last exercise of the previous round", () => {
    const c = ctx()
    const firstOfRound1 = applyAll(c, [LOG, LOG]) // round 1, exercise 0

    expect(blockRunnerReducer(firstOfRound1, BACK, c, 0)).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 1 },
    })
  })

  it("stays put when going back from the very first cell", () => {
    const c = ctx()
    expect(blockRunnerReducer(initialRunnerState(), BACK, c, 0)).toEqual(
      initialRunnerState(),
    )
  })

  it("re-enters the last cell when going back from done", () => {
    const c = ctx()
    const done = applyAll(c, [LOG, LOG, LOG, LOG])
    expect(done).toEqual({ phase: "done" })

    expect(blockRunnerReducer(done, BACK, c, 0)).toEqual({
      phase: "exercise",
      cursor: { round: 1, exerciseIdx: 1 },
    })
  })

  it("cancels a running timer and returns to the exercise just logged", () => {
    const c = ctx({ transitionSeconds: 20 })
    const transition = blockRunnerReducer(initialRunnerState(), LOG, c, 1_000)

    expect(blockRunnerReducer(transition, BACK, c, 0)).toEqual({
      phase: "exercise",
      cursor: { round: 0, exerciseIdx: 0 },
    })
  })

  it("leaves navigation untouched on CANCEL_LOG (the delete is a side effect)", () => {
    const c = ctx()
    const atSecond = blockRunnerReducer(initialRunnerState(), LOG, c, 0)

    expect(blockRunnerReducer(atSecond, { type: "CANCEL_LOG" }, c, 0)).toEqual(
      atSecond,
    )
    expect(
      blockRunnerReducer(
        atSecond,
        { type: "CANCEL_LOG", cursor: { round: 0, exerciseIdx: 0 } },
        c,
        0,
      ),
    ).toEqual(atSecond)
  })
})
