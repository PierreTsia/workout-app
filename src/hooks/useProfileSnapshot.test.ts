import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { addIsoDays, isoDayInTimeZone } from "@/lib/profile/windowRange"
import { useProfileAllTimeRollups, useProfileSnapshot } from "./useProfileSnapshot"
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

describe("useProfileAllTimeRollups", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_profile_all_time_rollups") {
        return Promise.resolve({
          data: { years: [], program_ids: [], regulars: [] },
          error: null,
        })
      }
      return Promise.resolve({
        data: { sessions: [], sets: [] },
        error: null,
      })
    })
  })

  it("fetches year rollups on All time without dumping set_logs, and 30d stays on the cached 200d snapshot", async () => {
    const today = isoDayInTimeZone(new Date(), "UTC")
    const { result, rerender, store } = renderHookWithProviders(
      ({ kind }: { kind: ProfileWindowKind }) => ({
        snapshot: useProfileSnapshot(kind),
        rollups: useProfileAllTimeRollups(kind === "all"),
      }),
      { initialProps: { kind: "7" } },
    )
    act(() => {
      store.set(authAtom, {
        id: "user-1",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      })
    })

    await waitFor(() => expect(result.current.snapshot.isSuccess).toBe(true))
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith("get_profile_snapshot", {
      p_from: addIsoDays(today, -199),
      p_to: today,
      p_tz: "UTC",
    })
    expect(mockRpc.mock.calls.some((call) => call[0] === "get_profile_all_time_rollups")).toBe(
      false,
    )

    rerender({ kind: "all" })
    await waitFor(() => expect(result.current.rollups.isSuccess).toBe(true))
    expect(
      mockRpc.mock.calls.filter((call) => call[0] === "get_profile_snapshot"),
    ).toHaveLength(1)
    expect(mockRpc).toHaveBeenCalledWith("get_profile_all_time_rollups", {
      p_tz: "UTC",
    })
    expect(
      mockRpc.mock.calls.some(
        (call) =>
          call[0] === "get_profile_snapshot" &&
          typeof call[1] === "object" &&
          call[1] != null &&
          "p_from" in call[1] &&
          call[1].p_from <= "2000-01-01",
      ),
    ).toBe(false)

    rerender({ kind: "30" })
    await waitFor(() => expect(result.current.snapshot.isSuccess).toBe(true))
    expect(
      mockRpc.mock.calls.filter((call) => call[0] === "get_profile_snapshot"),
    ).toHaveLength(1)
    expect(result.current.rollups.fetchStatus).toBe("idle")
  })
})
