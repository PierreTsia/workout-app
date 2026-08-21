import { describe, it, expect, vi, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import type { User } from "@supabase/supabase-js"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useProfileCircuitLedger } from "./useProfileCircuitLedger"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

function signedInUser(id: string): User {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

describe("useProfileCircuitLedger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads the unbounded catalog ledger for the signed-in user", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          session_id: "s1",
          started_at: "2026-08-20T09:00:00.000Z",
          finished_at: "2026-08-20T09:20:00.000Z",
          template_fingerprint: "amrap|1200|cindy",
          benchmark_circuit_id: "cindy-id",
          mode: "amrap",
          cap_seconds: 1200,
          label: "Cindy",
          cells: [],
        },
      ],
      error: null,
    })

    const { result, store } = renderHookWithProviders(() =>
      useProfileCircuitLedger(),
    )
    act(() => {
      store.set(authAtom, signedInUser("user-1"))
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith("get_profile_circuit_ledger")
    expect(mockRpc.mock.calls[0]?.[1]).toBeUndefined()
    expect(result.current.data?.[0]?.name).toBe("Cindy")
    expect(result.current.data?.[0]?.catalogId).toBe("cindy-id")
  })

  it("is disabled when no user is authenticated", () => {
    const { result } = renderHookWithProviders(() => useProfileCircuitLedger())

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
