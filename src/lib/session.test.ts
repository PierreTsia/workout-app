import { describe, it, expect, vi, afterEach } from "vitest"
import type { SessionState } from "@/store/atoms"
import { getEffectiveElapsed, resumeSessionFromPause } from "./session"

const BASE_SESSION: SessionState = {
  currentDayId: "d",
  activeDayId: "d",
  exerciseIndex: 0,
  setsData: {},
  startedAt: 1000,
  isActive: true,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
  cycleId: null,
}

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

describe("resumeSessionFromPause", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the same reference when not paused", () => {
    expect(resumeSessionFromPause(BASE_SESSION)).toBe(BASE_SESSION)
  })

  it("clears pausedAt and folds pause into accumulatedPause", () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    const paused = { ...BASE_SESSION, pausedAt: 2000, accumulatedPause: 100 }
    const out = resumeSessionFromPause(paused)
    expect(out.pausedAt).toBeNull()
    expect(out.accumulatedPause).toBe(100 + 3000)
  })
})
