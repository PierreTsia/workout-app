import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { sessionAtom, defaultSessionState } from "@/store/atoms"
import { useSessionOrientationGuard } from "./useSessionOrientationGuard"

function makeActiveSession(overrides: Partial<typeof defaultSessionState> = {}) {
  return {
    ...defaultSessionState,
    isActive: true,
    startedAt: 1_700_000_000_000,
    ...overrides,
  }
}

let lock: ReturnType<typeof vi.fn>
let unlock: ReturnType<typeof vi.fn>

beforeEach(() => {
  lock = vi.fn().mockResolvedValue(undefined)
  unlock = vi.fn()
  vi.stubGlobal("screen", {
    orientation: {
      lock,
      unlock,
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useSessionOrientationGuard", () => {
  it("attempts a portrait lock when a live session exists, without touching the DOM", async () => {
    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())

    store.set(sessionAtom, makeActiveSession())

    await waitFor(() => {
      expect(lock).toHaveBeenCalledTimes(1)
    })
    expect(lock).toHaveBeenCalledWith("portrait")
    expect(document.documentElement.className).not.toContain(
      "gl-session-orientation-guard",
    )
    expect(document.documentElement.hasAttribute("data-gl-rot")).toBe(false)
  })

  it("unlocks when the session ends", async () => {
    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())

    store.set(sessionAtom, makeActiveSession())
    await waitFor(() => {
      expect(lock).toHaveBeenCalledTimes(1)
    })

    store.set(sessionAtom, { ...defaultSessionState })

    await waitFor(() => {
      expect(unlock).toHaveBeenCalled()
    })
  })

  it("unlocks on unmount while a session is active", async () => {
    const { store, unmount } = renderHookWithProviders(() =>
      useSessionOrientationGuard(),
    )

    store.set(sessionAtom, makeActiveSession())
    await waitFor(() => {
      expect(lock).toHaveBeenCalledTimes(1)
    })

    unmount()

    expect(unlock).toHaveBeenCalled()
  })

  it("silently swallows lock() rejections", async () => {
    const rejectingLock = vi.fn().mockRejectedValue(new Error("denied"))
    vi.stubGlobal("screen", {
      orientation: { lock: rejectingLock, unlock },
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

  it("does not lock when isActive is true but startedAt is missing", async () => {
    const { store } = renderHookWithProviders(() => useSessionOrientationGuard())

    store.set(sessionAtom, makeActiveSession({ startedAt: null }))
    await new Promise((r) => setTimeout(r, 0))

    expect(lock).not.toHaveBeenCalled()
  })
})
