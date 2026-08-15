import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { useBlockSession } from "@/hooks/useBlockSession"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
} from "@/types/database"

const enqueueSetLog = vi.fn()
const scheduleImmediateDrain = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("@/lib/syncService", () => ({
  enqueueSetLog: (...args: unknown[]) => enqueueSetLog(...args),
  scheduleImmediateDrain: () => scheduleImmediateDrain(),
  peekSessionRealId: vi.fn(() => null),
}))

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
})
