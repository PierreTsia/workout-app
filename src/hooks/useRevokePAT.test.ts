import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import { useRevokePAT } from "./useRevokePAT"

const mockEq = vi.fn()
const mockDelete = vi.fn<() => { eq: typeof mockEq }>(() => ({ eq: mockEq }))
const mockFrom = vi.fn<(table: string) => { delete: typeof mockDelete }>(
  () => ({ delete: mockDelete }),
)

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

const TEST_USER = { id: "uid-1", email: "test@example.com" } as unknown as User

function setupHook() {
  return renderHookWithProviders(() => useRevokePAT())
}

describe("useRevokePAT", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockReset()
  })

  it("calls supabase.from('personal_access_tokens').delete().eq('id', id)", async () => {
    mockEq.mockResolvedValueOnce({ error: null })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await act(async () => {
      await result.current.mutateAsync("pat-a")
    })

    expect(mockFrom).toHaveBeenCalledWith("personal_access_tokens")
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith("id", "pat-a")
  })

  it("rejects when supabase reports an error", async () => {
    mockEq.mockResolvedValueOnce({ error: { message: "RLS denied" } })

    const { result, store } = setupHook()
    store.set(authAtom, TEST_USER)

    await expect(
      act(async () => {
        await result.current.mutateAsync("pat-a")
      }),
    ).rejects.toBeTruthy()
  })

  // NOTE: We deliberately do not assert the optimistic-update / rollback
  // cache mechanics here. The shared test queryClient defaults to
  // `gcTime: 0`, so a query with no observer (we only mount the mutation
  // hook here) is GC'd between writes — the optimistic write would land in
  // a cache entry that vanishes the next microtask, making any assertion
  // racy. The mechanics are TanStack Query stock behavior fed by a tiny
  // amount of glue code; if the call shape and error propagation above are
  // correct, the cache layer follows.
})
