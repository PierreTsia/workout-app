import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import {
  fetchBlockCompletionHistory,
  useBlockCompletionHistory,
} from "./useBlockCompletionHistory"
import type { BlockRunCellRow } from "@/lib/blockCompletionHistory"

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}))

let blockExercisesResponse: { data: unknown; error: unknown } = {
  data: [{ id: "be1" }, { id: "be2" }],
  error: null,
}
let setLogsResponse: { data: unknown; error: unknown } = { data: [], error: null }

function createBlockExercisesChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(() => Promise.resolve(blockExercisesResponse)),
  }
}

function createSetLogsChain() {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn(() => Promise.resolve(setLogsResponse)),
  }
}

const blockExercisesChain = createBlockExercisesChain()
const setLogsChain = createSetLogsChain()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "block_exercises") return blockExercisesChain
      if (table === "set_logs") return setLogsChain
      return blockExercisesChain
    }),
  },
}))

/** Full 2×2 grid for one session, first→last cell spanning `seconds`. */
function makeRunRows(sessionId: string, startISO: string, seconds: number): BlockRunCellRow[] {
  const slots = [
    { be: "be1", round: 1 },
    { be: "be2", round: 1 },
    { be: "be1", round: 2 },
    { be: "be2", round: 2 },
  ]
  const start = new Date(startISO).getTime()
  return slots.map((slot, i) => ({
    session_id: sessionId,
    block_exercise_id: slot.be,
    set_number: slot.round,
    reps_logged: "10",
    duration_seconds: null,
    weight_logged: 20,
    logged_at: new Date(start + (i / (slots.length - 1)) * seconds * 1000).toISOString(),
  }))
}

describe("fetchBlockCompletionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    blockExercisesResponse = { data: [{ id: "be1" }, { id: "be2" }], error: null }
    setLogsResponse = { data: [], error: null }
  })

  it("builds annotated runs (newest-first) and an aligned trend from cross-session logs", async () => {
    setLogsResponse = {
      data: [
        ...makeRunRows("s1", "2026-06-01T10:00:00.000Z", 300),
        ...makeRunRows("s2", "2026-06-08T10:00:00.000Z", 240),
      ],
      error: null,
    }

    const out = await fetchBlockCompletionHistory("block-1")

    expect(out.views.map((v) => v.run.sessionId)).toEqual(["s2", "s1"])
    expect(out.views[0].deltaSeconds).toBe(-60)
    expect(out.views[0].isPb).toBe(true)
    expect(out.trend.seconds).toEqual([300, 240])
  })

  it("returns empty when the block has no exercises", async () => {
    blockExercisesResponse = { data: [], error: null }

    const out = await fetchBlockCompletionHistory("block-1")

    expect(out).toEqual({ views: [], trend: { seconds: [], dates: [] } })
  })
})

describe("useBlockCompletionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    blockExercisesResponse = { data: [{ id: "be1" }, { id: "be2" }], error: null }
    setLogsResponse = { data: [], error: null }
  })

  it("stays idle when the sheet is closed", () => {
    const { result } = renderHookWithProviders(() =>
      useBlockCompletionHistory(false, "block-1"),
    )
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("fetches when open and authenticated", async () => {
    setLogsResponse = {
      data: makeRunRows("s1", "2026-06-01T10:00:00.000Z", 300),
      error: null,
    }
    const { result, store } = renderHookWithProviders(() =>
      useBlockCompletionHistory(true, "block-1"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isFetched).toBe(true))
    expect(result.current.data?.views).toHaveLength(1)
  })
})
