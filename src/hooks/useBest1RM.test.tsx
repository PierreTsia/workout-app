import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useBest1RM } from "./useBest1RM"

// ---------------------------------------------------------------------------
// Chainable Supabase mock
// ---------------------------------------------------------------------------

function createChain(resolveWith: { data?: unknown; error?: unknown } = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then: ReturnType<typeof vi.fn>
  } = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: vi.fn((resolve: (v: unknown) => void) =>
      resolve({
        data: resolveWith.data ?? null,
        error: resolveWith.error ?? null,
      }),
    ),
  }
  return chain
}

let setLogsChain = createChain({ data: [] })

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => setLogsChain),
  },
}))

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("useBest1RM", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLogsChain = createChain({ data: [] })
  })

  it("computes best 1RM from multiple rows using Epley", async () => {
    setLogsChain = createChain({
      data: [
        { reps_logged: "10", weight_logged: 100, estimated_1rm: null },
        { reps_logged: "5", weight_logged: 120, estimated_1rm: null },
      ],
    })

    const { result, store } = renderHookWithProviders(() =>
      useBest1RM("ex-1"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    // Epley: 100*(1+10/30) = 133.33, 120*(1+5/30) = 140
    expect(result.current.data).toBeCloseTo(140, 1)
  })

  it("uses estimated_1rm directly when present", async () => {
    setLogsChain = createChain({
      data: [
        { reps_logged: "10", weight_logged: 100, estimated_1rm: 150 },
      ],
    })

    const { result, store } = renderHookWithProviders(() =>
      useBest1RM("ex-1"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toBe(150)
  })

  it("returns 0 when data is empty", async () => {
    setLogsChain = createChain({ data: [] })

    const { result, store } = renderHookWithProviders(() =>
      useBest1RM("ex-1"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toBe(0)
  })

  it("disables the query when exerciseId is undefined", () => {
    const { result } = renderHookWithProviders(() => useBest1RM(undefined))

    expect(result.current.data).toBeUndefined()
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("disables the query when there is no auth", () => {
    const { result } = renderHookWithProviders(() => useBest1RM("ex-1"))

    expect(result.current.data).toBeUndefined()
    expect(result.current.fetchStatus).toBe("idle")
  })
})
