import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { getDefaultStore } from "jotai"
import { setVisibility } from "@/test/utils"
import { sessionAtom, defaultSessionState, type SessionState } from "@/store/atoms"
import { VISIBILITY_GUARD_MS } from "@/lib/session"
import { useSessionVisibilityAutoPause } from "./useSessionVisibilityAutoPause"

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

  it("counts a hidden span of 15 min or less on return", () => {
    renderHook(() => useSessionVisibilityAutoPause())

    act(() => {
      setVisibility("hidden")
    })
    vi.setSystemTime(10_000 + VISIBILITY_GUARD_MS)
    act(() => {
      setVisibility("visible")
    })

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBeNull()
    expect(session.pausedByVisibility).toBeFalsy()
    expect(session.accumulatedPause).toBe(0)
  })

  it("excludes the whole hidden span when it exceeds 15 min", () => {
    renderHook(() => useSessionVisibilityAutoPause())

    act(() => {
      setVisibility("hidden")
    })
    const hidden = VISIBILITY_GUARD_MS + 60_000
    vi.setSystemTime(10_000 + hidden)
    act(() => {
      setVisibility("visible")
    })

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBeNull()
    expect(session.accumulatedPause).toBe(hidden)
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

  it("resumes a persisted guard pause on mount while visible, counting a short span", () => {
    seedSession({ pausedAt: 5_000, pausedByVisibility: true })
    vi.setSystemTime(20_000)

    renderHook(() => useSessionVisibilityAutoPause())

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBeNull()
    expect(session.accumulatedPause).toBe(0)
  })

  it("resumes a persisted guard pause on mount while visible, excluding a long span", () => {
    seedSession({ pausedAt: 5_000, pausedByVisibility: true })
    const hidden = VISIBILITY_GUARD_MS + 60_000
    vi.setSystemTime(5_000 + hidden)

    renderHook(() => useSessionVisibilityAutoPause())

    const session = getDefaultStore().get(sessionAtom)
    expect(session.pausedAt).toBeNull()
    expect(session.accumulatedPause).toBe(hidden)
  })
})
