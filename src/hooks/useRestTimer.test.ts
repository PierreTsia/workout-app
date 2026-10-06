import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { restAtom, sessionAtom } from "@/store/atoms"
import { useRestTimer, getRestElapsedSeconds } from "./useRestTimer"
import { VISIBILITY_GUARD_MS } from "@/lib/session"
import type { RestState } from "@/store/atoms"

const { mockPlayFinishBeeps, mockPlayWarningBeep } = vi.hoisted(() => ({
  mockPlayFinishBeeps: vi.fn(),
  mockPlayWarningBeep: vi.fn(),
}))

vi.mock("@/lib/audio", () => ({
  playFinishBeeps: mockPlayFinishBeeps,
  playWarningBeep: mockPlayWarningBeep,
}))

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("useRestTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns inactive state when restAtom is null", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, null)
    })

    expect(result.current.isActive).toBe(false)
    expect(result.current.remaining).toBe(0)
    expect(result.current.formatted).toBe("00:00")
  })

  it("returns active state when restAtom has value", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.remaining).toBe(90)
    expect(result.current.formatted).toBe("01:30")
  })

  it("counts down over time", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    expect(result.current.remaining).toBe(90)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(result.current.remaining).toBe(80)
  })

  it("freezes rest when workout session is paused", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
      store.set(sessionAtom, (prev) => ({ ...prev, pausedAt: null }))
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.remaining).toBe(80)

    act(() => {
      store.set(sessionAtom, (prev) => ({
        ...prev,
        pausedAt: t0 + 10_000,
      }))
    })

    expect(result.current.isPaused).toBe(true)
    const frozenRemaining = result.current.remaining
    expect(frozenRemaining).toBe(80)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(result.current.remaining).toBe(frozenRemaining)
  })

  it("resumes rest countdown after workout session resumes", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
      store.set(sessionAtom, (prev) => ({ ...prev, pausedAt: null }))
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.remaining).toBe(80)

    act(() => {
      store.set(sessionAtom, (prev) => ({
        ...prev,
        pausedAt: t0 + 10_000,
      }))
    })

    act(() => {
      vi.advanceTimersByTime(10_000)
      store.set(sessionAtom, (prev) => ({ ...prev, pausedAt: null }))
    })

    expect(result.current.remaining).toBe(80)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(result.current.remaining).toBe(75)
  })

  it("counts a short visibility pause (≤ 15 min) in the rest timer", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
      store.set(sessionAtom, (prev) => ({ ...prev, pausedAt: null }))
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.remaining).toBe(80)

    act(() => {
      store.set(sessionAtom, (prev) => ({
        ...prev,
        pausedAt: t0 + 10_000,
        pausedByVisibility: true,
      }))
    })
    expect(result.current.isPaused).toBe(true)

    act(() => {
      vi.advanceTimersByTime(10_000)
      store.set(sessionAtom, (prev) => ({
        ...prev,
        pausedAt: null,
        pausedByVisibility: undefined,
      }))
    })

    expect(result.current.isPaused).toBe(false)
    expect(result.current.remaining).toBe(70)
  })

  it("excludes a long visibility pause (> 15 min) from the rest timer", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 1800,
        pausedAt: null,
        accumulatedPause: 0,
      })
      store.set(sessionAtom, (prev) => ({ ...prev, pausedAt: null }))
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.remaining).toBe(1790)

    act(() => {
      store.set(sessionAtom, (prev) => ({
        ...prev,
        pausedAt: t0 + 10_000,
        pausedByVisibility: true,
      }))
    })

    const hidden = VISIBILITY_GUARD_MS + 60_000
    act(() => {
      vi.advanceTimersByTime(hidden)
      store.set(sessionAtom, (prev) => ({
        ...prev,
        pausedAt: null,
        pausedByVisibility: undefined,
      }))
    })

    expect(result.current.remaining).toBe(1790)
  })

  it("forces a tick on visibilitychange to visible", () => {
    vi.useFakeTimers()
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })
    expect(result.current.remaining).toBe(90)

    // Time passes while the interval is throttled (timers not advanced).
    act(() => {
      vi.setSystemTime(t0 + 10_000)
    })
    act(() => {
      setVisibility("visible")
    })

    expect(result.current.remaining).toBe(80)
  })

  it("shows a rest finished in the background as finished on return, without restarting", () => {
    vi.useFakeTimers()
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 5,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    // The rest ends while backgrounded; the interval never ticks.
    act(() => {
      vi.setSystemTime(t0 + 10_000)
    })
    act(() => {
      setVisibility("visible")
    })

    expect(result.current.remaining).toBe(0)
    expect(result.current.isActive).toBe(true)

    // Clears after the grace delay — no new countdown.
    act(() => {
      vi.advanceTimersByTime(1_200)
    })
    expect(result.current.isActive).toBe(false)
  })

  it("fires the finish alert on return when the rest ended in the background", () => {
    vi.useFakeTimers()
    mockPlayFinishBeeps.mockClear()
    const { store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 5,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    act(() => {
      vi.setSystemTime(t0 + 10_000)
    })
    act(() => {
      setVisibility("visible")
    })

    expect(mockPlayFinishBeeps).toHaveBeenCalledTimes(1)
  })

  it("keeps user rest pause when session resumes if rest was paused before session", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    const t0 = 0
    act(() => {
      vi.setSystemTime(t0)
    })
    act(() => {
      store.set(restAtom, {
        startedAt: t0,
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
      store.set(sessionAtom, (prev) => ({ ...prev, pausedAt: null }))
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.remaining).toBe(80)

    act(() => {
      result.current.pause()
    })
    const userPausedRemaining = result.current.remaining

    act(() => {
      store.set(sessionAtom, (prev) => ({
        ...prev,
        pausedAt: t0 + 10_000,
      }))
    })
    act(() => {
      vi.advanceTimersByTime(60_000)
      store.set(sessionAtom, (prev) => ({ ...prev, pausedAt: null }))
    })

    expect(result.current.isPaused).toBe(true)
    expect(result.current.remaining).toBe(userPausedRemaining)
  })

  it("pauses the timer", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.remaining).toBe(80)

    act(() => {
      result.current.pause()
    })

    expect(result.current.isPaused).toBe(true)
    const pausedRemaining = result.current.remaining

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(result.current.remaining).toBe(pausedRemaining)
  })

  it("resumes the timer after pause", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    act(() => {
      vi.advanceTimersByTime(10_000)
      result.current.pause()
    })

    const pausedRemaining = result.current.remaining

    act(() => {
      vi.advanceTimersByTime(5_000)
      result.current.resume()
    })

    expect(result.current.isPaused).toBe(false)
    expect(result.current.remaining).toBe(pausedRemaining)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(result.current.remaining).toBe(pausedRemaining - 5)
  })

  it("togglePause switches between paused and running", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    expect(result.current.isPaused).toBe(false)

    act(() => {
      result.current.togglePause()
    })
    expect(result.current.isPaused).toBe(true)

    act(() => {
      result.current.togglePause()
    })
    expect(result.current.isPaused).toBe(false)
  })

  it("skip clears the timer", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    expect(result.current.isActive).toBe(true)

    act(() => {
      result.current.skip()
    })

    expect(result.current.isActive).toBe(false)
    expect(store.get(restAtom)).toBeNull()
  })

  it("resets notification flags when a new timer starts", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())

    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 5,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    act(() => {
      vi.advanceTimersByTime(6_000)
    })

    expect(result.current.remaining).toBe(0)

    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 90,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    expect(result.current.remaining).toBe(90)
    expect(result.current.isActive).toBe(true)
  })

  it("calculates progress correctly", () => {
    const { result, store } = renderHookWithProviders(() => useRestTimer())
    act(() => {
      store.set(restAtom, {
        startedAt: Date.now(),
        durationSeconds: 100,
        pausedAt: null,
        accumulatedPause: 0,
      })
    })

    expect(result.current.progress).toBe(0)

    act(() => {
      vi.advanceTimersByTime(50_000)
    })

    expect(result.current.progress).toBeCloseTo(0.5, 1)

    act(() => {
      vi.advanceTimersByTime(50_000)
    })

    expect(result.current.progress).toBe(1)
  })
})

describe("getRestElapsedSeconds", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns null when rest is null", () => {
    expect(getRestElapsedSeconds(null, null)).toBeNull()
  })

  it("returns elapsed seconds for active rest", () => {
    const rest: RestState = {
      startedAt: Date.now() - 30_000,
      durationSeconds: 90,
      pausedAt: null,
      accumulatedPause: 0,
    }
    expect(getRestElapsedSeconds(rest, null)).toBe(30)
  })

  it("accounts for accumulated pause", () => {
    const rest: RestState = {
      startedAt: Date.now() - 40_000,
      durationSeconds: 90,
      pausedAt: null,
      accumulatedPause: 10_000,
    }
    expect(getRestElapsedSeconds(rest, null)).toBe(30)
  })

  it("freezes at pausedAt when rest is paused", () => {
    const now = Date.now()
    const rest: RestState = {
      startedAt: now - 20_000,
      durationSeconds: 90,
      pausedAt: now - 5_000,
      accumulatedPause: 0,
    }
    expect(getRestElapsedSeconds(rest, null)).toBe(15)
  })

  it("freezes at sessionPausedAt when session is paused", () => {
    const now = Date.now()
    const rest: RestState = {
      startedAt: now - 25_000,
      durationSeconds: 90,
      pausedAt: null,
      accumulatedPause: 0,
    }
    expect(getRestElapsedSeconds(rest, now - 5_000)).toBe(20)
  })

  it("clamps to 0 when elapsed would be negative", () => {
    const rest: RestState = {
      startedAt: Date.now() + 5_000,
      durationSeconds: 90,
      pausedAt: null,
      accumulatedPause: 0,
    }
    expect(getRestElapsedSeconds(rest, null)).toBe(0)
  })
})
