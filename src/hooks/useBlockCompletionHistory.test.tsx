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

let exerciseBlocksResponse: { data: unknown; error: unknown } = {
  data: { mode: "rounds" },
  error: null,
}
let blockExercisesResponse: { data: unknown; error: unknown } = {
  data: [{ id: "be1" }, { id: "be2" }],
  error: null,
}
let setLogsResponse: { data: unknown; error: unknown } = { data: [], error: null }
let blockRunsResponse: { data: unknown; error: unknown } = { data: [], error: null }

function createExerciseBlocksChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve(exerciseBlocksResponse)),
  }
}

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

function createBlockRunsChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve(blockRunsResponse)),
  }
}

const exerciseBlocksChain = createExerciseBlocksChain()
const blockExercisesChain = createBlockExercisesChain()
const setLogsChain = createSetLogsChain()
const blockRunsChain = createBlockRunsChain()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "exercise_blocks") return exerciseBlocksChain
      if (table === "block_exercises") return blockExercisesChain
      if (table === "set_logs") return setLogsChain
      if (table === "block_runs") return blockRunsChain
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
    exerciseBlocksResponse = { data: { mode: "rounds" }, error: null }
    blockExercisesResponse = { data: [{ id: "be1" }, { id: "be2" }], error: null }
    setLogsResponse = { data: [], error: null }
    blockRunsResponse = { data: [], error: null }
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

    expect(out.mode).toBe("rounds")
    expect(out.views.map((v) => v.run.sessionId)).toEqual(["s2", "s1"])
    expect(out.views[0].deltaSeconds).toBe(-60)
    expect(out.views[0].isPb).toBe(true)
    expect(out.trend.seconds).toEqual([300, 240])
    expect(out.amrapViews).toEqual([])
  })

  it("returns empty when the block has no exercises", async () => {
    blockExercisesResponse = { data: [], error: null }

    const out = await fetchBlockCompletionHistory("block-1")

    expect(out).toEqual({
      mode: "rounds",
      views: [],
      trend: { seconds: [], dates: [] },
      amrapViews: [],
    })
  })

  it("scores a finished AMRAP from block_runs + leftover logs, not CCT", async () => {
    exerciseBlocksResponse = { data: { mode: "amrap" }, error: null }
    blockRunsResponse = {
      data: [
        {
          session_id: "s1",
          started_at: "2026-08-15T10:00:00.000Z",
          finished_at: "2026-08-15T10:20:00.000Z",
          template_fingerprint: "amrap|1200|ex-1:5:0",
        },
      ],
      error: null,
    }
    setLogsResponse = {
      data: [
        {
          session_id: "s1",
          set_number: 1,
          reps_logged: "5",
          duration_seconds: null,
          logged_at: "2026-08-15T10:01:00.000Z",
          exercise_name_snapshot: "push-ups",
        },
        {
          session_id: "s1",
          set_number: 28,
          reps_logged: "3",
          duration_seconds: null,
          logged_at: "2026-08-15T10:19:50.000Z",
          exercise_name_snapshot: "push-ups",
        },
      ],
      error: null,
    }

    const out = await fetchBlockCompletionHistory("cindy")

    expect(out.mode).toBe("amrap")
    expect(out.views).toEqual([])
    expect(out.trend).toEqual({ seconds: [], dates: [] })
    expect(out.amrapViews).toHaveLength(1)
    expect(out.amrapViews[0].score).toEqual({
      fullRounds: 27,
      leftover: 3,
      leftoverName: "push-ups",
    })
  })
})

describe("useBlockCompletionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    exerciseBlocksResponse = { data: { mode: "rounds" }, error: null }
    blockExercisesResponse = { data: [{ id: "be1" }, { id: "be2" }], error: null }
    setLogsResponse = { data: [], error: null }
    blockRunsResponse = { data: [], error: null }
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
