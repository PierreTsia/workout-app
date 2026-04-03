import { describe, expect, it } from "vitest"
import { hasEnoughBalanceData } from "./volumeByMuscleGroup"
import { MUSCLE_TAXONOMY } from "./trainingBalance"

describe("hasEnoughBalanceData", () => {
  it("returns false when fewer than 3 finished sessions", () => {
    expect(
      hasEnoughBalanceData({
        finished_sessions: 2,
        muscles: MUSCLE_TAXONOMY.map((m) => ({
          muscle_group: m,
          total_sets: 5,
          total_volume_kg: 100,
          exercise_count: 1,
        })),
      }),
    ).toBe(false)
  })

  it("returns false when total weighted sets are zero", () => {
    expect(
      hasEnoughBalanceData({
        finished_sessions: 5,
        muscles: MUSCLE_TAXONOMY.map((m) => ({
          muscle_group: m,
          total_sets: 0,
          total_volume_kg: 0,
          exercise_count: 0,
        })),
      }),
    ).toBe(false)
  })

  it("returns true with enough sessions and some sets", () => {
    expect(
      hasEnoughBalanceData({
        finished_sessions: 3,
        muscles: MUSCLE_TAXONOMY.map((m) => ({
          muscle_group: m,
          total_sets: m === "Pectoraux" ? 4 : 0,
          total_volume_kg: 0,
          exercise_count: 0,
        })),
      }),
    ).toBe(true)
  })
})
