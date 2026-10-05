import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { getDefaultStore } from "jotai"
import { sessionAtom, defaultSessionState, type SessionState } from "@/store/atoms"
import { useSessionVisibilityAutoPause } from "./useSessionVisibilityAutoPause"

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event("visibilitychange"))
}

function seedSession(overrides: Partial<SessionState> = {}) {
  const store = getDefaultStore()
  store.set(sessionAtom, {
    ...defaultSessionState,
    isActive: true,
    startedAt: 1000,
    ...overrides,
  })
  return store
}

describe("useSessionVisibilityAutoPause", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    setVisibility("visible")
    seedSession()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("auto-pauses an active session when the app is hidden", () => {
    renderHook(() => useSessionVisibilityAutoPause())

    act(() => {
      setVisibility("hidden")
    })

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBe(10_000)
    expect(session.pausedByVisibility).toBe(true)
  })

  it("folds the hidden span into accumulatedPause and resumes on return", () => {
    renderHook(() => useSessionVisibilityAutoPause())

    act(() => {
      setVisibility("hidden")
    })
    vi.setSystemTime(40_000)
    act(() => {
      setVisibility("visible")
    })

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBeNull()
    expect(session.pausedByVisibility).toBeFalsy()
    expect(session.accumulatedPause).toBe(30_000)
  })

  it("never clobbers a manual pause on hide, and does not resume it on return", () => {
    seedSession({ pausedAt: 5_000, accumulatedPause: 0 })
    renderHook(() => useSessionVisibilityAutoPause())

    act(() => {
      setVisibility("hidden")
    })
    expect(getDefaultStore().get(sessionAtom).pausedAt).toBe(5_000)

    vi.setSystemTime(40_000)
    act(() => {
      setVisibility("visible")
    })

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBe(5_000)
    expect(session.accumulatedPause).toBe(0)
  })

  it("resumes a persisted auto-pause on mount while visible", () => {
    seedSession({ pausedAt: 5_000, pausedByVisibility: true })
    vi.setSystemTime(20_000)

    renderHook(() => useSessionVisibilityAutoPause())

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBeNull()
    expect(session.accumulatedPause).toBe(15_000)
  })
})
