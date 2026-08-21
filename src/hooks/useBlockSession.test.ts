import { vi, describe, it, expect, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useBlockSession } from "@/hooks/useBlockSession"
import {
  discardBlockRun,
  peekSessionRealId,
  queuedSetLogPayloadsForSession,
} from "@/lib/syncService"
import type {
  BlockExerciseWithExercise,
  Exercise,
  ExerciseBlockWithExercises,
} from "@/types/database"
import type { SetLogPayloadReps } from "@/lib/syncService"

const enqueueSetLog = vi.fn()
const scheduleImmediateDrain = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("@/lib/syncService", () => ({
  enqueueSetLog: (...args: unknown[]) => enqueueSetLog(...args),
  scheduleImmediateDrain: () => scheduleImmediateDrain(),
  peekSessionRealId: vi.fn(() => null),
  queuedSetLogPayloadsForSession: vi.fn(() => []),
  queuedBlockRunFor: vi.fn(() => null),
  enqueueBlockRun: vi.fn(),
  discardBlockRun: vi.fn().mockResolvedValue(undefined),
  discardBlockSetLogs: vi.fn().mockResolvedValue(undefined),
}))

const fetchBestPerformance = vi.fn(async () => ({
  bestValue: 200,
  hasPriorSession: true,
  modality: "weighted_reps" as const,
}))

vi.mock("@/hooks/useBestPerformance", () => ({
  bestPerformanceQueryKey: (
    userId: string,
    args: {
      exerciseId?: string
      localSessionId: string
      measurementType?: string
      equipment?: string
      sessionStartedAtMs?: number | null
    },
  ) => [
    "best-performance",
    userId,
    args.exerciseId,
    args.localSessionId,
    args.measurementType ?? "reps",
    args.equipment ?? "",
    args.sessionStartedAtMs ?? 0,
  ],
  fetchBestPerformance: () => fetchBestPerformance(),
  prefetchBestPerformance: vi.fn(),
  useBestPerformance: vi.fn(),
}))

function makeQueuedLog(
  over: Partial<SetLogPayloadReps> = {},
): SetLogPayloadReps {
  return {
    sessionId: "local-1",
    exerciseId: "ex-1",
    blockExerciseId: "be-A",
    exerciseNameSnapshot: "Push-ups",
    setNumber: 1,
    repsLogged: "20",
    weightLogged: 0,
    estimatedOneRM: 0,
    wasPr: false,
    loggedAt: 1000,
    ...over,
  }
}

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: "ex-1",
  name: "Push-ups",
  muscle_group: "chest",
  emoji: "💪",
  is_system: true,
  created_at: "2026-01-01",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "bodyweight",
  difficulty_level: null,
  name_en: null,
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  ...over,
})

const blockExercise = (
  over: Partial<BlockExerciseWithExercise> = {},
): BlockExerciseWithExercise => ({
  id: "be-A",
  block_id: "blk-1",
  exercise_id: "ex-1",
  name_snapshot: "Push-ups",
  muscle_snapshot: "chest",
  emoji_snapshot: "💪",
  position: 0,
  per_round: [
    { amount: 20, weight: 0 },
    { amount: 15, weight: 0 },
  ],
  exercise: null,
  ...over,
})

const block = (
  over: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises => ({
  id: "blk-1",
  workout_day_id: "day-1",
  label: "Circuit",
  rounds: 2,
  rest_seconds: 0,
  transition_seconds: 0,
  mode: "rounds",
  cap_seconds: null,
  sort_order: 0,
  created_at: "2026-01-01",
  exercises: [blockExercise()],
  ...over,
})

describe("useBlockSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queuedSetLogPayloadsForSession).mockReturnValue([])
  })

  it("enqueues a block-tagged set_log for the logged cell", () => {
    const { result, store } = renderHookWithProviders(() =>
      useBlockSession(block(), "local-1"),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    act(() => result.current.logAndAdvance())

    expect(enqueueSetLog).toHaveBeenCalledTimes(1)
    expect(enqueueSetLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "local-1",
        exerciseId: "ex-1",
        blockExerciseId: "be-A",
        setNumber: 1,
        repsLogged: "20",
      }),
    )
    expect(scheduleImmediateDrain).toHaveBeenCalledTimes(1)
  })

  it("merges queued set_logs into loggedCells on remount so the cursor resumes", () => {
    vi.mocked(queuedSetLogPayloadsForSession).mockReturnValue([
      makeQueuedLog(),
    ])

    const { result } = renderHookWithProviders(() =>
      useBlockSession(block(), "local-1"),
    )

    expect(result.current.loggedCells.has("be-A#1")).toBe(true)
    expect(result.current.state).toEqual({
      phase: "exercise",
      cursor: { round: 1, exerciseIdx: 0 },
    })
  })

  it("wipes the Block Run together with block logs on discard", async () => {
    vi.mocked(peekSessionRealId).mockReturnValue("real-1")
    const { result, store } = renderHookWithProviders(() =>
      useBlockSession(
        block({ mode: "amrap", cap_seconds: 1200, rounds: 1 }),
        "local-1",
      ),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await act(async () => {
      await result.current.discardBlock()
    })

    expect(discardBlockRun).toHaveBeenCalledWith("real-1", "blk-1")
  })

  it("flags wasPr on the queued payload when a weighted station beats prior scores", async () => {
    const { result, store } = renderHookWithProviders(() =>
      useBlockSession(
        block({
          rounds: 1,
          exercises: [
            blockExercise({
              id: "be-deadlift",
              exercise_id: "ex-deadlift",
              name_snapshot: "Deadlift",
              per_round: [{ amount: 5, weight: 180 }],
              exercise: exercise({
                id: "ex-deadlift",
                name: "Deadlift",
                equipment: "barbell",
                measurement_type: "reps",
              }),
            }),
          ],
        }),
        "local-1",
      ),
    )
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })

    await waitFor(() => expect(fetchBestPerformance).toHaveBeenCalled())

    act(() => result.current.logAndAdvance())

    expect(enqueueSetLog).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: "ex-deadlift",
        wasPr: true,
      }),
    )
  })
})
