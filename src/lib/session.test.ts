import { describe, it, expect } from "vitest"
import { getEffectiveElapsed } from "./session"

describe("getEffectiveElapsed", () => {
  const T0 = 1_000_000

  it("returns 0 when startedAt is null", () => {
    expect(
      getEffectiveElapsed({ startedAt: null, pausedAt: null, accumulatedPause: 0 }, T0),
    ).toBe(0)
  })

  it("computes simple elapsed with no pause", () => {
    expect(
      getEffectiveElapsed({ startedAt: T0, pausedAt: null, accumulatedPause: 0 }, T0 + 30_000),
    ).toBe(30_000)
  })

  it("subtracts accumulatedPause from elapsed", () => {
    expect(
      getEffectiveElapsed(
        { startedAt: T0, pausedAt: null, accumulatedPause: 5_000 },
        T0 + 30_000,
      ),
    ).toBe(25_000)
  })

  it("subtracts current in-progress pause", () => {
    const pausedAt = T0 + 20_000
    expect(
      getEffectiveElapsed(
        { startedAt: T0, pausedAt, accumulatedPause: 0 },
        T0 + 30_000,
      ),
    ).toBe(20_000)
  })

  it("handles multiple pause/resume cycles (accumulated + current pause)", () => {
    const pausedAt = T0 + 50_000
    expect(
      getEffectiveElapsed(
        { startedAt: T0, pausedAt, accumulatedPause: 10_000 },
        T0 + 60_000,
      ),
    ).toBe(40_000)
  })

  it("treats undefined accumulatedPause as 0 (backward compat)", () => {
    expect(
      getEffectiveElapsed(
        { startedAt: T0, pausedAt: null, accumulatedPause: undefined as unknown as number },
        T0 + 15_000,
      ),
    ).toBe(15_000)
  })
})
