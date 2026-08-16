import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor, act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import {
  fetchBenchmarkCompletionHistory,
  useBenchmarkCompletionHistory,
} from "./useBenchmarkCompletionHistory"

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}))

const CINDY_ID = "cindy-catalog"
const FP_20 = "amrap|1200|ex-1:5:0,ex-2:10:0,ex-3:15:0"

let catalogResponse: { data: unknown; error: unknown } = { data: null, error: null }
let blockRunsResponse: { data: unknown; error: unknown } = { data: [], error: null }
let blockExercisesResponse: { data: unknown; error: unknown } = { data: [], error: null }
let setLogsResponse: { data: unknown; error: unknown } = { data: [], error: null }

const catalogChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(() => Promise.resolve(catalogResponse)),
}
const blockRunsChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn(() => Promise.resolve(blockRunsResponse)),
}
const blockExercisesChain = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn(() => Promise.resolve(blockExercisesResponse)),
}
const setLogsChain = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn(() => Promise.resolve(setLogsResponse)),
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "benchmark_circuits") return catalogChain
      if (table === "block_runs") return blockRunsChain
      if (table === "block_exercises") return blockExercisesChain
      if (table === "set_logs") return setLogsChain
      return catalogChain
    }),
  },
}))

function leftoverLog(
  sessionId: string,
  setNumber: number,
  reps: string,
  name: string,
) {
  return {
    session_id: sessionId,
    set_number: setNumber,
    reps_logged: reps,
    duration_seconds: null,
    logged_at: "2026-08-15T10:19:50.000Z",
    exercise_name_snapshot: name,
  }
}

describe("fetchBenchmarkCompletionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    catalogResponse = { data: null, error: null }
    blockRunsResponse = { data: [], error: null }
    blockExercisesResponse = { data: [], error: null }
    setLogsResponse = { data: [], error: null }
  })

  it("groups two cindy days under one catalog id and updates the same PB", async () => {
    blockRunsResponse = {
      data: [
        {
          session_id: "s2",
          block_id: "block-next-month",
          started_at: "2026-08-15T10:00:00.000Z",
          finished_at: "2026-08-15T10:20:00.000Z",
          template_fingerprint: FP_20,
        },
        {
          session_id: "s1",
          block_id: "block-tuesday",
          started_at: "2026-08-01T10:00:00.000Z",
          finished_at: "2026-08-01T10:20:00.000Z",
          template_fingerprint: FP_20,
        },
      ],
      error: null,
    }
    blockExercisesResponse = {
      data: [{ id: "be-tue" }, { id: "be-next" }],
      error: null,
    }
    setLogsResponse = {
      data: [
        leftoverLog("s1", 26, "8", "push-ups"),
        leftoverLog("s2", 28, "3", "push-ups"),
      ],
      error: null,
    }

    const out = await fetchBenchmarkCompletionHistory(CINDY_ID)

    expect(blockRunsChain.eq).toHaveBeenCalledWith("benchmark_circuit_id", CINDY_ID)
    expect(out.amrapViews.map((v) => v.sessionId)).toEqual(["s2", "s1"])
    expect(out.amrapViews[0].score).toEqual({
      fullRounds: 27,
      leftover: 3,
      leftoverName: "push-ups",
    })
    expect(out.amrapViews[0].isPb).toBe(true)
    expect(out.amrapViews[0].deltaRounds).toBe(2)
    expect(out.amrapViews[1].isPb).toBe(false)
    expect(out.amrapViews[1].deltaRounds).toBeNull()
  })

  it("loads seed story and withholds delta on the first cindy run", async () => {
    catalogResponse = {
      data: {
        slug: "cindy",
        tagline_fr: "Le WOD de Tom Holland. 20 min.",
        tagline_en: "Tom Holland’s WOD. 20 min.",
        story_fr:
          "Cinq tractions, dix pompes, quinze squats. Autant de tours que possible. Le score s’écrit 27+3, pas en kilos. Holland a posé 27 tours — à toi de voir.",
        story_en:
          "Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible. The score is 27+3, not kilos. Holland did 27 rounds — your move.",
        reference: { name: "Tom Holland", score: "27" },
      },
      error: null,
    }
    blockRunsResponse = {
      data: [
        {
          session_id: "s1",
          block_id: "block-tuesday",
          started_at: "2026-08-01T10:00:00.000Z",
          finished_at: "2026-08-01T10:20:00.000Z",
          template_fingerprint: FP_20,
        },
      ],
      error: null,
    }
    blockExercisesResponse = { data: [{ id: "be-tue" }], error: null }
    setLogsResponse = {
      data: [leftoverLog("s1", 28, "3", "push-ups")],
      error: null,
    }

    const out = await fetchBenchmarkCompletionHistory(CINDY_ID)

    expect(catalogChain.eq).toHaveBeenCalledWith("id", CINDY_ID)
    expect(out.copy).toEqual({
      slug: "cindy",
      tagline_fr: "Le WOD de Tom Holland. 20 min.",
      tagline_en: "Tom Holland’s WOD. 20 min.",
      story_fr:
        "Cinq tractions, dix pompes, quinze squats. Autant de tours que possible. Le score s’écrit 27+3, pas en kilos. Holland a posé 27 tours — à toi de voir.",
      story_en:
        "Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible. The score is 27+3, not kilos. Holland did 27 rounds — your move.",
      reference: { name: "Tom Holland", score: "27" },
    })
    expect(out.amrapViews).toHaveLength(1)
    expect(out.amrapViews[0].deltaRounds).toBeNull()
    expect(out.amrapViews[0].isPb).toBe(false)
    expect(out.amrapViews.map((v) => v.sessionId)).not.toContain("holland")
  })

  it("does not let a cap-10 fingerprint steal the 20 min PB", async () => {
    const fp10 = "amrap|600|ex-1:5:0,ex-2:10:0,ex-3:15:0"
    blockRunsResponse = {
      data: [
        {
          session_id: "cap10",
          block_id: "block-cap10",
          started_at: "2026-08-15T10:00:00.000Z",
          finished_at: "2026-08-15T10:10:00.000Z",
          template_fingerprint: fp10,
        },
        {
          session_id: "s2",
          block_id: "block-next-month",
          started_at: "2026-08-08T10:00:00.000Z",
          finished_at: "2026-08-08T10:20:00.000Z",
          template_fingerprint: FP_20,
        },
        {
          session_id: "s1",
          block_id: "block-tuesday",
          started_at: "2026-08-01T10:00:00.000Z",
          finished_at: "2026-08-01T10:20:00.000Z",
          template_fingerprint: FP_20,
        },
      ],
      error: null,
    }
    blockExercisesResponse = {
      data: [{ id: "be-tue" }, { id: "be-next" }, { id: "be-cap" }],
      error: null,
    }
    setLogsResponse = {
      data: [
        leftoverLog("s1", 21, "0", "push-ups"),
        leftoverLog("s2", 23, "0", "push-ups"),
        leftoverLog("cap10", 41, "0", "push-ups"),
      ],
      error: null,
    }

    const out = await fetchBenchmarkCompletionHistory(CINDY_ID)
    const byId = Object.fromEntries(out.amrapViews.map((v) => [v.sessionId, v]))

    expect(byId.s2.isPb).toBe(true)
    expect(byId.s2.score?.fullRounds).toBe(22)
    expect(byId.cap10.isPb).toBe(false)
    expect(byId.cap10.score?.fullRounds).toBe(40)
    expect(byId.s2.fingerprint).not.toBe(byId.cap10.fingerprint)
  })
})

describe("useBenchmarkCompletionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    catalogResponse = { data: null, error: null }
    blockRunsResponse = { data: [], error: null }
    blockExercisesResponse = { data: [], error: null }
    setLogsResponse = { data: [], error: null }
  })

  it("stays idle when the sheet is closed", () => {
    const { result } = renderHookWithProviders(() =>
      useBenchmarkCompletionHistory(false, CINDY_ID),
    )
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("fetches when open and authenticated", async () => {
    blockRunsResponse = {
      data: [
        {
          session_id: "s1",
          block_id: "block-tuesday",
          started_at: "2026-08-01T10:00:00.000Z",
          finished_at: "2026-08-01T10:20:00.000Z",
          template_fingerprint: FP_20,
        },
      ],
      error: null,
    }
    blockExercisesResponse = { data: [{ id: "be-tue" }], error: null }
    setLogsResponse = {
      data: [leftoverLog("s1", 28, "3", "push-ups")],
      error: null,
    }

    const { result, store } = renderHookWithProviders(() =>
      useBenchmarkCompletionHistory(true, CINDY_ID),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(result.current.isFetched).toBe(true))
    expect(result.current.data?.amrapViews).toHaveLength(1)
  })
})
