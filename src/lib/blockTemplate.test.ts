import { describe, it, expect } from "vitest"
import {
  switchBlockMode,
  templateCell,
  templateFingerprint,
} from "@/lib/blockTemplate"
import type { BlockExerciseWithExercise, PerRoundCell } from "@/types/database"

function makeCells(...amounts: number[]): PerRoundCell[] {
  return amounts.map((amount) => ({ amount, weight: 0 }))
}

function makeTemplate(
  overrides: Partial<Parameters<typeof switchBlockMode>[0]> = {},
) {
  return {
    mode: "rounds" as const,
    rounds: 3,
    cap_seconds: null,
    rest_seconds: 90,
    transition_seconds: 20,
    exercises: [
      { per_round: makeCells(5, 5, 5) },
      { per_round: makeCells(10, 10, 10) },
      { per_round: makeCells(15, 15, 15) },
    ],
    ...overrides,
  }
}

function makeBlockExercise(
  per_round: PerRoundCell[],
): BlockExerciseWithExercise {
  return {
    id: "be-A",
    block_id: "blk-1",
    exercise_id: "ex-1",
    name_snapshot: "Push-ups",
    muscle_snapshot: "chest",
    emoji_snapshot: "💪",
    position: 0,
    per_round,
    exercise: null,
  }
}

describe("templateCell", () => {
  it("always reads per_round[0] on AMRAP so a late round does not explode", () => {
    const be = makeBlockExercise(makeCells(5))

    expect(templateCell(be, 7, "amrap")).toEqual({ amount: 5, weight: 0 })
  })

  it("reads the matching Tours cell for that round", () => {
    const be = makeBlockExercise(makeCells(5, 8, 12))

    expect(templateCell(be, 1, "rounds")).toEqual({ amount: 8, weight: 0 })
  })
})

describe("templateFingerprint", () => {
  it("snapshots mode, cap, and sorted exercise amounts so a later edit cannot rewrite history", () => {
    const push = makeBlockExercise(makeCells(5))
    const squat = {
      ...makeBlockExercise(makeCells(10)),
      id: "be-B",
      exercise_id: "ex-2",
    }

    expect(
      templateFingerprint({
        mode: "amrap",
        cap_seconds: 1200,
        exercises: [squat, push],
      }),
    ).toBe("amrap|1200|ex-1:5:0,ex-2:10:0")
  })
})

describe("switchBlockMode", () => {
  it("keeps round 1, forces length 1 and a 20 min cap when switching to AMRAP", () => {
    const next = switchBlockMode(makeTemplate(), "amrap")

    expect(next.mode).toBe("amrap")
    expect(next.rounds).toBe(1)
    expect(next.cap_seconds).toBe(20 * 60)
    expect(next.rest_seconds).toBe(0)
    expect(next.transition_seconds).toBe(0)
    expect(next.exercises.map((e) => e.per_round)).toEqual([
      [{ amount: 5, weight: 0 }],
      [{ amount: 10, weight: 0 }],
      [{ amount: 15, weight: 0 }],
    ])
  })

  it("restores 3 Tours, propagates round 1, and sets rest to 90", () => {
    const amrap = switchBlockMode(makeTemplate(), "amrap")
    const next = switchBlockMode(amrap, "rounds")

    expect(next.mode).toBe("rounds")
    expect(next.rounds).toBe(3)
    expect(next.cap_seconds).toBeNull()
    expect(next.rest_seconds).toBe(90)
    expect(next.exercises.map((e) => e.per_round)).toEqual([
      makeCells(5, 5, 5),
      makeCells(10, 10, 10),
      makeCells(15, 15, 15),
    ])
  })
})
