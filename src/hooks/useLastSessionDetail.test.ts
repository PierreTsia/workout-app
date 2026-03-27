import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useLastSessionDetail } from "./useLastSessionDetail"

// ---------------------------------------------------------------------------
// Chainable Supabase mock — mirrors the chain used in useBest1RM tests
// ---------------------------------------------------------------------------

function createChain(resolveWith: { data?: unknown; error?: unknown } = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then: ReturnType<typeof vi.fn>
  } = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    order: vi.fn(() => chain),
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
// Test data helpers
// ---------------------------------------------------------------------------

const SESSION_A = "session-a"
const SESSION_B = "session-b"

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    set_number: 1,
    reps_logged: "10",
    weight_logged: 80,
    rir: 2,
    session_id: SESSION_A,
    duration_seconds: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("useLastSessionDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLogsChain = createChain({ data: [] })
  })

  it("disables the query when exerciseId is undefined", () => {
    const { result } = renderHookWithProviders(() => useLastSessionDetail(undefined))
    expect(result.current.data).toBeUndefined()
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("disables the query when there is no auth", () => {
    const { result } = renderHookWithProviders(() => useLastSessionDetail("ex-1"))
    expect(result.current.data).toBeUndefined()
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("returns null when there are no set_logs", async () => {
    setLogsChain = createChain({ data: [] })

    const { result, store } = renderHookWithProviders(() => useLastSessionDetail("ex-1"))
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it("maps a single session correctly", async () => {
    setLogsChain = createChain({
      data: [
        makeLog({ set_number: 1, reps_logged: "10", weight_logged: 80, rir: 2 }),
        makeLog({ set_number: 2, reps_logged: "8", weight_logged: 80, rir: 1 }),
      ],
    })

    const { result, store } = renderHookWithProviders(() => useLastSessionDetail("ex-1"))
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { reps: 10, weight: 80, completed: true, rir: 2 },
      { reps: 8, weight: 80, completed: true, rir: 1 },
    ])
  })

  it("keeps only the latest session when multiple sessions exist", async () => {
    setLogsChain = createChain({
      data: [
        makeLog({ session_id: SESSION_A, reps_logged: "12", weight_logged: 90 }),
        makeLog({ session_id: SESSION_B, reps_logged: "6", weight_logged: 60 }),
      ],
    })

    const { result, store } = renderHookWithProviders(() => useLastSessionDetail("ex-1"))
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].reps).toBe(12)
  })

  it("filters out duration rows (duration_seconds != null)", async () => {
    setLogsChain = createChain({
      data: [
        makeLog({ reps_logged: "10", duration_seconds: null }),
        makeLog({ reps_logged: "10", duration_seconds: 30 }),
      ],
    })

    const { result, store } = renderHookWithProviders(() => useLastSessionDetail("ex-1"))
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it("handles corrupt reps_logged by falling back to 0", async () => {
    setLogsChain = createChain({
      data: [makeLog({ reps_logged: null })],
    })

    const { result, store } = renderHookWithProviders(() => useLastSessionDetail("ex-1"))
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].reps).toBe(0)
  })

  it("calls .lt to exclude current-session logs when sessionStartedAt is provided", async () => {
    setLogsChain = createChain({ data: [] })
    const startedAt = new Date("2026-03-27T14:00:00Z").getTime()

    const { result, store } = renderHookWithProviders(() =>
      useLastSessionDetail("ex-1", startedAt),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setLogsChain.lt).toHaveBeenCalledWith(
      "logged_at",
      new Date(startedAt).toISOString(),
    )
  })

  it("does not call .lt when sessionStartedAt is omitted", async () => {
    setLogsChain = createChain({ data: [] })

    const { result, store } = renderHookWithProviders(() => useLastSessionDetail("ex-1"))
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setLogsChain.lt).not.toHaveBeenCalled()
  })

  it("returns duration rows with durationSeconds when measurementType is 'duration'", async () => {
    setLogsChain = createChain({
      data: [
        makeLog({ reps_logged: null, duration_seconds: 30, weight_logged: 0 }),
        makeLog({ reps_logged: null, duration_seconds: 25, weight_logged: 0 }),
      ],
    })

    const { result, store } = renderHookWithProviders(() =>
      useLastSessionDetail("ex-1", null, "duration"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].durationSeconds).toBe(30)
    expect(result.current.data![1].durationSeconds).toBe(25)
    expect(result.current.data![0].reps).toBe(0)
  })

  it("filters out reps rows when measurementType is 'duration'", async () => {
    setLogsChain = createChain({
      data: [
        makeLog({ reps_logged: "10", duration_seconds: null }),
        makeLog({ reps_logged: null, duration_seconds: 30 }),
      ],
    })

    const { result, store } = renderHookWithProviders(() =>
      useLastSessionDetail("ex-1", null, "duration"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].durationSeconds).toBe(30)
  })

  it("default measurementType still filters out duration rows (backward compat)", async () => {
    setLogsChain = createChain({
      data: [
        makeLog({ reps_logged: "10", duration_seconds: null }),
        makeLog({ reps_logged: null, duration_seconds: 30 }),
      ],
    })

    const { result, store } = renderHookWithProviders(() =>
      useLastSessionDetail("ex-1"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].reps).toBe(10)
    expect(result.current.data![0].durationSeconds).toBeUndefined()
  })
})
