import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useKeepScreenAwake } from "./useKeepScreenAwake"

type MockSentinel = {
  release: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function makeMockSentinel(): MockSentinel {
  return {
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

let issuedSentinels: MockSentinel[]
let wakeLockRequest: ReturnType<typeof vi.fn>

beforeEach(() => {
  issuedSentinels = []
  wakeLockRequest = vi.fn(async () => {
    const sentinel = makeMockSentinel()
    issuedSentinels.push(sentinel)
    return sentinel
  })
  vi.stubGlobal("navigator", { wakeLock: { request: wakeLockRequest } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useKeepScreenAwake", () => {
  it("requests the wake lock when mounted with active=true", async () => {
    renderHook(() => useKeepScreenAwake(true))

    await waitFor(() => {
      expect(wakeLockRequest).toHaveBeenCalledTimes(1)
    })
    expect(wakeLockRequest).toHaveBeenCalledWith("screen")
  })

  it("releases the sentinel when active flips to false", async () => {
    const { rerender } = renderHook(
      ({ active }) => useKeepScreenAwake(active),
      { initialProps: { active: true } },
    )
    await waitFor(() => expect(issuedSentinels).toHaveLength(1))

    rerender({ active: false })

    await waitFor(() => {
      expect(issuedSentinels[0].release).toHaveBeenCalled()
    })
  })

  it("releases the sentinel on unmount while active", async () => {
    const { unmount } = renderHook(() => useKeepScreenAwake(true))
    await waitFor(() => expect(issuedSentinels).toHaveLength(1))

    unmount()

    await waitFor(() => {
      expect(issuedSentinels[0].release).toHaveBeenCalled()
    })
  })

  it("re-acquires the wake lock when the tab returns to visible after an auto-release", async () => {
    renderHook(() => useKeepScreenAwake(true))
    await waitFor(() => expect(issuedSentinels).toHaveLength(1))

    const releaseListener = issuedSentinels[0].addEventListener.mock.calls.find(
      ([eventType]) => eventType === "release",
    )?.[1] as (() => void) | undefined
    expect(releaseListener).toBeDefined()

    act(() => {
      releaseListener!()
      document.dispatchEvent(new Event("visibilitychange"))
    })

    await waitFor(() => {
      expect(issuedSentinels).toHaveLength(2)
    })
  })

  it("no-ops when navigator.wakeLock is undefined", () => {
    vi.stubGlobal("navigator", {})

    expect(() => renderHook(() => useKeepScreenAwake(true))).not.toThrow()
  })

  it("silently swallows request() rejections", async () => {
    const rejectingRequest = vi.fn().mockRejectedValue(new Error("denied"))
    vi.stubGlobal("navigator", { wakeLock: { request: rejectingRequest } })
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)

    try {
      renderHook(() => useKeepScreenAwake(true))
      await waitFor(() => expect(rejectingRequest).toHaveBeenCalled())
      await new Promise((r) => setTimeout(r, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off("unhandledRejection", unhandled)
    }
  })
})
