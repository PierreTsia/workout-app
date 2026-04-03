import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useBestPerformance, fetchBestPerformance } from "./useBestPerformance"

vi.mock("@/lib/syncService", () => ({
  getSessionRealId: vi.fn(() => "real-session-1"),
}))

let sessionsResponse: { data: unknown; error: unknown } = {
  data: null,
  error: null,
}
let setLogsResponse: { data: unknown; error: unknown } = {
  data: [],
  error: null,
}

function createSessionsChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve(sessionsResponse)),
  }
}

function createSetLogsChain() {
  const chain = {
    select: vi.fn(function selectFn(this: unknown) {
      return this
    }),
    eq: vi.fn(() => Promise.resolve(setLogsResponse)),
  }
  return chain
}

const sessionsChain = createSessionsChain()
const setLogsChain = createSetLogsChain()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "sessions") return sessionsChain
      if (table === "set_logs") return setLogsChain
      return sessionsChain
    }),
  },
}))

describe("useBestPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionsResponse = {
      data: { started_at: "2025-06-01T12:00:00.000Z" },
      error: null,
    }
    setLogsResponse = { data: [], error: null }
  })

  it("computes bestValue and hasPriorSession from prior finished sessions", async () => {
    setLogsResponse = {
      data: [
        {
          reps_logged: "10",
          weight_logged: 100,
          estimated_1rm: null,
          duration_seconds: null,
          session_id: "past-1",
          sessions: {
            started_at: "2025-01-01T10:00:00.000Z",
            finished_at: "2025-01-01T11:00:00.000Z",
          },
        },
      ],
      error: null,
    }

    const { result, store } = renderHookWithProviders(() =>
      useBestPerformance({
        exerciseId: "ex-1",
        localSessionId: "local-1",
        sessionStartedAtMs: Date.parse("2025-06-01T12:00:00.000Z"),
        measurementType: "reps",
        equipment: "barbell",
      }),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isFetched).toBe(true))
    expect(result.current.data?.bestValue).toBeCloseTo(133.33, 1)
    expect(result.current.data?.hasPriorSession).toBe(true)
  })

  it("disables when exerciseId is undefined", () => {
    const { result } = renderHookWithProviders(() =>
      useBestPerformance({
        exerciseId: undefined,
        localSessionId: "local-1",
        sessionStartedAtMs: 1,
        measurementType: "reps",
        equipment: "barbell",
      }),
    )

    expect(result.current.fetchStatus).toBe("idle")
  })
})

describe("fetchBestPerformance (integration-shaped)", () => {
  it("returns zero hasPriorSession when no prior sessions before current start", async () => {
    sessionsResponse = {
      data: { started_at: "2025-06-01T12:00:00.000Z" },
      error: null,
    }
    setLogsResponse = {
      data: [
        {
          reps_logged: "10",
          weight_logged: 100,
          estimated_1rm: null,
          duration_seconds: null,
          session_id: "real-session-1",
          sessions: {
            started_at: "2025-06-01T12:00:00.000Z",
            finished_at: "2025-06-01T13:00:00.000Z",
          },
        },
      ],
      error: null,
    }

    const out = await fetchBestPerformance("user-1", {
      exerciseId: "ex-1",
      localSessionId: "local-1",
      sessionStartedAtMs: Date.parse("2025-06-01T12:00:00.000Z"),
      measurementType: "reps",
      equipment: "barbell",
    })

    expect(out.hasPriorSession).toBe(false)
    expect(out.bestValue).toBe(0)
  })
})
