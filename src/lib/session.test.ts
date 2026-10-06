import { describe, it, expect, vi, afterEach } from "vitest"
import type { SessionState } from "@/store/atoms"
import {
  getEffectiveElapsed,
  pauseSessionForVisibility,
  resumeSessionFromPause,
  resumeSessionFromVisibilityPause,
  VISIBILITY_GUARD_MS,
} from "./session"

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

describe("pauseSessionForVisibility", () => {
  it("pauses an active, unpaused session and flags it as visibility-paused", () => {
    const out = pauseSessionForVisibility({ ...BASE_SESSION, startedAt: 1000 }, 5000)
    expect(out.pausedAt).toBe(5000)
    expect(out.pausedByVisibility).toBe(true)
  })

  it("never clobbers a manual pause", () => {
    const manual = { ...BASE_SESSION, pausedAt: 2000, accumulatedPause: 100 }
    expect(pauseSessionForVisibility(manual, 5000)).toBe(manual)
  })

  it("no-ops on an inactive session", () => {
    const inactive = { ...BASE_SESSION, isActive: false }
    expect(pauseSessionForVisibility(inactive, 5000)).toBe(inactive)
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

  it("clears the visibility auto-pause flag on resume", () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    const paused = {
      ...BASE_SESSION,
      pausedAt: 2000,
      pausedByVisibility: true,
    }
    const out = resumeSessionFromPause(paused)
    expect(out.pausedByVisibility).toBeFalsy()
  })
})

describe("resumeSessionFromVisibilityPause", () => {
  const T0 = 1_000_000

  it("counts a hidden span of 15 min or less (no exclusion)", () => {
    const paused = {
      ...BASE_SESSION,
      pausedAt: T0,
      pausedByVisibility: true,
      accumulatedPause: 100,
    }
    const { session, resolution } = resumeSessionFromVisibilityPause(
      paused,
      T0 + VISIBILITY_GUARD_MS,
    )
    expect(session.pausedAt).toBeNull()
    expect(session.pausedByVisibility).toBeFalsy()
    expect(session.accumulatedPause).toBe(100)
    expect(resolution).toEqual({
      pausedAt: T0,
      hiddenMs: VISIBILITY_GUARD_MS,
      excluded: false,
    })
  })

  it("excludes the whole hidden span when it exceeds 15 min", () => {
    const hidden = VISIBILITY_GUARD_MS + 1
    const paused = {
      ...BASE_SESSION,
      pausedAt: T0,
      pausedByVisibility: true,
      accumulatedPause: 100,
    }
    const { session, resolution } = resumeSessionFromVisibilityPause(
      paused,
      T0 + hidden,
    )
    expect(session.pausedAt).toBeNull()
    expect(session.accumulatedPause).toBe(100 + hidden)
    expect(resolution).toEqual({ pausedAt: T0, hiddenMs: hidden, excluded: true })
  })

  it("never touches a manual pause", () => {
    const manual = { ...BASE_SESSION, pausedAt: T0, accumulatedPause: 100 }
    const { session, resolution } = resumeSessionFromVisibilityPause(
      manual,
      T0 + 60_000,
    )
    expect(session).toBe(manual)
    expect(resolution).toBeNull()
  })

  it("no-ops when the session is not paused", () => {
    const { session, resolution } = resumeSessionFromVisibilityPause(
      BASE_SESSION,
      T0 + 60_000,
    )
    expect(session).toBe(BASE_SESSION)
    expect(resolution).toBeNull()
  })
})
