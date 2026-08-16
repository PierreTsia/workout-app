import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useBlockRun } from "@/hooks/useBlockRun"
import {
  enqueueBlockRun,
  queuedBlockRunFor,
  type BlockRunPayload,
} from "@/lib/syncService"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
} from "@/types/database"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("@/lib/syncService", () => ({
  queuedBlockRunFor: vi.fn(() => null),
  enqueueBlockRun: vi.fn(),
  discardBlockRun: vi.fn().mockResolvedValue(undefined),
  peekSessionRealId: vi.fn(() => null),
  scheduleImmediateDrain: vi.fn(),
}))

const T0 = 1_700_000_000_000
const CINDY_ID = "11111111-1111-4111-8111-111111111111"
const FORK_ID = "22222222-2222-4222-8222-222222222222"

const queuedRun = (
  over: Partial<BlockRunPayload> = {},
): BlockRunPayload => ({
  sessionId: "local-1",
  blockId: "blk-1",
  startedAt: T0,
  finishedAt: null,
  mode: "amrap",
  capSeconds: 1200,
  templateFingerprint: "amrap|1200|ex-1:5:0",
  benchmarkCircuitId: null,
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
  per_round: [{ amount: 5, weight: 0 }],
  exercise: null,
  ...over,
})

const amrapBlock = (
  over: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises => ({
  id: "blk-1",
  workout_day_id: "day-1",
  label: "Cindy",
  rounds: 1,
  rest_seconds: 0,
  transition_seconds: 0,
  mode: "amrap",
  cap_seconds: 1200,
  sort_order: 0,
  created_at: "2026-01-01",
  exercises: [blockExercise()],
  ...over,
})

describe("useBlockRun", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queuedBlockRunFor).mockReturnValue(null)
  })

  it("hydrates started_at from the queue so a remount skips a second GO", () => {
    vi.mocked(queuedBlockRunFor).mockReturnValue(queuedRun())

    const { result } = renderHookWithProviders(() =>
      useBlockRun(amrapBlock(), "local-1"),
    )

    expect(result.current.startedAt).toBe(T0)
    expect(result.current.finishedAt).toBeNull()
    expect(result.current.hydratePending).toBe(false)
  })

  it("enqueues a Block Run at the GO instant for AMRAP", () => {
    const { result } = renderHookWithProviders(() =>
      useBlockRun(amrapBlock(), "local-1"),
    )

    act(() => result.current.stampGo(T0))

    expect(enqueueBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "local-1",
        blockId: "blk-1",
        startedAt: T0,
        finishedAt: null,
        mode: "amrap",
        capSeconds: 1200,
      }),
    )
    expect(result.current.startedAt).toBe(T0)
  })

  it("stamps the catalog id on GO when the day's block is Cindy-linked", () => {
    const { result } = renderHookWithProviders(() =>
      useBlockRun(amrapBlock({ benchmark_circuit_id: CINDY_ID }), "local-1"),
    )

    act(() => result.current.stampGo(T0))

    expect(enqueueBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ benchmarkCircuitId: CINDY_ID }),
    )
  })

  it("writes null on GO for a jetable AMRAP", () => {
    const { result } = renderHookWithProviders(() =>
      useBlockRun(amrapBlock(), "local-1"),
    )

    act(() => result.current.stampGo(T0))

    expect(enqueueBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ benchmarkCircuitId: null }),
    )
  })

  it("keeps a jetable GO snapshot when the day's block is later linked to a catalog", () => {
    vi.mocked(queuedBlockRunFor).mockReturnValue(queuedRun())

    const { result } = renderHookWithProviders(() =>
      useBlockRun(amrapBlock({ benchmark_circuit_id: CINDY_ID }), "local-1"),
    )

    act(() => result.current.stampFinish(T0 + 60_000))

    expect(enqueueBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ benchmarkCircuitId: null }),
    )
  })

  it("keeps the GO catalog snapshot when the day's block is later retargeted", () => {
    vi.mocked(queuedBlockRunFor).mockReturnValue(
      queuedRun({ benchmarkCircuitId: CINDY_ID }),
    )

    const { result } = renderHookWithProviders(() =>
      useBlockRun(amrapBlock({ benchmark_circuit_id: FORK_ID }), "local-1"),
    )

    act(() => result.current.stampFinish(T0 + 60_000))

    expect(enqueueBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ benchmarkCircuitId: CINDY_ID }),
    )
  })

  it("does not write a Block Run for Tours", () => {
    const tours = amrapBlock({ mode: "rounds", cap_seconds: null, rounds: 3 })
    const { result } = renderHookWithProviders(() =>
      useBlockRun(tours, "local-1"),
    )

    act(() => result.current.stampGo(T0))

    expect(enqueueBlockRun).not.toHaveBeenCalled()
    expect(result.current.startedAt).toBeNull()
  })
})
