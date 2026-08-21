import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { addIsoDays, isoDayInTimeZone } from "@/lib/profile/windowRange"
import { useProfileSnapshot } from "./useProfileSnapshot"
import type { ProfileWindowKind } from "@/lib/profile/window"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

vi.mock("@/lib/trainingActivityTimezone", () => ({
  getResolvedIANATimeZone: () => "UTC",
}))

describe("useProfileSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({
      data: { sessions: [], sets: [] },
      error: null,
    })
  })

  it("is disabled when no user is authenticated", () => {
    const { result } = renderHookWithProviders(() => useProfileSnapshot("7"))

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("does not dump lifetime set_logs on All time", () => {
    const { result, store } = renderHookWithProviders(() =>
      useProfileSnapshot("all"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("fetches 200d once for 7/30/100 and 730d when toggling 1y", async () => {
    const today = isoDayInTimeZone(new Date(), "UTC")
    const { result, rerender, store } = renderHookWithProviders(
      ({ kind }: { kind: ProfileWindowKind }) => useProfileSnapshot(kind),
      { initialProps: { kind: "7" } },
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith("get_profile_snapshot", {
      p_from: addIsoDays(today, -199),
      p_to: today,
      p_tz: "UTC",
    })

    rerender({ kind: "30" })
    rerender({ kind: "100" })
    expect(mockRpc).toHaveBeenCalledTimes(1)

    rerender({ kind: "365" })
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2))
    expect(mockRpc).toHaveBeenLastCalledWith("get_profile_snapshot", {
      p_from: addIsoDays(today, -729),
      p_to: today,
      p_tz: "UTC",
    })
  })
})
