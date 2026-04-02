import { describe, it, expect, vi, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useBadgeStatus } from "./useBadgeStatus"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

describe("useBadgeStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls get_badge_status RPC with user id", async () => {
    mockRpc.mockResolvedValue({
      data: [{ tier_id: "t1", group_slug: "consistency_streak" }],
      error: null,
    })

    const { result, store } = renderHookWithProviders(() => useBadgeStatus())
    act(() => { store.set(authAtom, { id: "user-1" } as never) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith("get_badge_status", {
      p_user_id: "user-1",
    })
    expect(result.current.data).toHaveLength(1)
  })

  it("is disabled when no user is authenticated", () => {
    const { result } = renderHookWithProviders(() => useBadgeStatus())

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
