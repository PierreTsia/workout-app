import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { sessionAtom, defaultSessionState } from "@/store/atoms"
import { useSessionOrientationGuard } from "./useSessionOrientationGuard"

const GUARD_CLASS = "gl-session-orientation-guard"

function makeActiveSession(overrides: Partial<typeof defaultSessionState> = {}) {
  return {
    ...defaultSessionState,
    isActive: true,
    startedAt: 1_700_000_000_000,
    ...overrides,
  }
}

type OrientationListeners = Record<string, () => void>

let lock: ReturnType<typeof vi.fn>
let unlock: ReturnType<typeof vi.fn>
let orientationListeners: OrientationListeners

beforeEach(() => {
  lock = vi.fn().mockResolvedValue(undefined)
  unlock = vi.fn()
  orientationListeners = {}
  vi.stubGlobal("screen", {
    orientation: {
      lock,
      unlock,
      angle: 0,
      type: "portrait-primary",
      addEventListener: vi.fn((event: string, cb: () => void) => {
        orientationListeners[event] = cb
      }),
      removeEventListener: vi.fn(),
    },
  })
  document.documentElement.classList.remove(GUARD_CLASS)
  document.documentElement.removeAttribute("data-gl-rot")
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove(GUARD_CLASS)
  document.documentElement.removeAttribute("data-gl-rot")
})

describe("useSessionOrientationGuard", () => {
  it("adds the guard class and attempts the portrait lock when a live session exists", async () => {
    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())

    store.set(sessionAtom, makeActiveSession())

    await waitFor(() => {
      expect(document.documentElement.classList.contains(GUARD_CLASS)).toBe(true)
    })
    await waitFor(() => {
      expect(lock).toHaveBeenCalledTimes(1)
    })
    expect(lock).toHaveBeenCalledWith("portrait")
  })

  it("removes the guard class and unlocks when the session ends", async () => {
    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())

    store.set(sessionAtom, makeActiveSession())
    await waitFor(() => {
      expect(document.documentElement.classList.contains(GUARD_CLASS)).toBe(true)
    })

    store.set(sessionAtom, { ...defaultSessionState })

    await waitFor(() => {
      expect(document.documentElement.classList.contains(GUARD_CLASS)).toBe(false)
    })
    expect(unlock).toHaveBeenCalled()
  })

  it("removes the guard class on unmount while a session is active", async () => {
    const { store, unmount } = renderHookWithProviders(() =>
      useSessionOrientationGuard(),
    )

    store.set(sessionAtom, makeActiveSession())
    await waitFor(() => {
      expect(document.documentElement.classList.contains(GUARD_CLASS)).toBe(true)
    })

    unmount()

    expect(document.documentElement.classList.contains(GUARD_CLASS)).toBe(false)
    expect(unlock).toHaveBeenCalled()
  })

  it("derives data-gl-rot from the orientation angle and refreshes it on change", async () => {
    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())
    const root = document.documentElement

    vi.stubGlobal("screen", {
      orientation: {
        lock,
        unlock,
        angle: 90,
        type: "landscape-primary",
        addEventListener: vi.fn((event: string, cb: () => void) => {
          orientationListeners[event] = cb
        }),
        removeEventListener: vi.fn(),
      },
    })

    store.set(sessionAtom, makeActiveSession())
    await waitFor(() => {
      expect(root.getAttribute("data-gl-rot")).toBe("-90")
    })

    act(() => {
      vi.stubGlobal("screen", {
        orientation: {
          lock,
          unlock,
          angle: -90,
          type: "landscape-secondary",
          addEventListener: vi.fn((event: string, cb: () => void) => {
            orientationListeners[event] = cb
          }),
          removeEventListener: vi.fn(),
        },
      })
      orientationListeners.change?.()
    })

    await waitFor(() => {
      expect(root.getAttribute("data-gl-rot")).toBe("90")
    })

    store.set(sessionAtom, { ...defaultSessionState })
    await waitFor(() => {
      expect(root.hasAttribute("data-gl-rot")).toBe(false)
    })
  })

  it("silently swallows lock() rejections", async () => {
    const rejectingLock = vi.fn().mockRejectedValue(new Error("denied"))
    vi.stubGlobal("screen", {
      orientation: {
        lock: rejectingLock,
        unlock,
        angle: 0,
        type: "portrait-primary",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })
    const unhandled = vi.fn()
    window.addEventListener("unhandledrejection", unhandled)

    try {
      const { store } = renderHookWithProviders(() =>
        useSessionOrientationGuard(),
      )
      store.set(sessionAtom, makeActiveSession())
      await waitFor(() => expect(rejectingLock).toHaveBeenCalled())
      await new Promise((r) => setTimeout(r, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener("unhandledrejection", unhandled)
    }
  })

  it("does not guard when isActive is true but startedAt is missing", async () => {
    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())

    store.set(sessionAtom, makeActiveSession({ startedAt: null }))
    await new Promise((r) => setTimeout(r, 0))

    expect(document.documentElement.classList.contains(GUARD_CLASS)).toBe(false)
    expect(lock).not.toHaveBeenCalled()
  })

  it("no-ops when screen.orientation.lock is undefined", async () => {
    vi.stubGlobal("screen", {
      orientation: {
        unlock,
        angle: 0,
        type: "portrait-primary",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())
    expect(() => store.set(sessionAtom, makeActiveSession())).not.toThrow()
    await waitFor(() => {
      expect(document.documentElement.classList.contains(GUARD_CLASS)).toBe(true)
    })
  })
})
