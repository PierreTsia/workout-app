import { describe, it, expect } from "vitest"
import { switchBlockMode } from "@/lib/blockTemplate"
import type { PerRoundCell } from "@/types/database"

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
