import { describe, it, expect, vi, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import {
  requireParallelSlotArrays,
  useProgressionSuggestionsForDay,
} from "./useProgressionSuggestionsForDay"
import type { WorkoutExercise } from "@/types/database"

const rpcMock = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

// T708 — the hook reads the catalog `equipment` for the day's exercises. The
// real `useExerciseBatch` reaches Supabase; isolate it and let each test decide
// which catalog rows are loaded.
const { batchMock } = vi.hoisted(() => ({
  batchMock: vi.fn<() => { data: unknown[] }>(() => ({ data: [] })),
}))

vi.mock("@/hooks/useExerciseBatch", () => ({
  useExerciseBatch: () => batchMock(),
}))

function makeExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: "we-1",
    workout_day_id: "day-1",
    exercise_id: "ex-1",
    name_snapshot: "Bench Press",
    muscle_snapshot: "chest",
    emoji_snapshot: "🏋️",
    sets: 3,
    reps: "10",
    weight: "80",
    rest_seconds: 90,
    sort_order: 0,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    template_updated_at: "2020-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    workout_exercise_id: "we-1",
    exercise_id: "ex-1",
    session_id: "sess-1",
    set_number: 1,
    reps_logged: "10",
    weight_logged: 80,
    rir: 2,
    duration_seconds: null,
    logged_at: "2026-05-26T10:00:00Z",
    prescribed_reps: null,
    prescribed_weight: null,
    prescribed_sets: null,
    prescribed_duration_seconds: null,
    session_finished_at: "2026-05-26T10:30:00Z",
    ...overrides,
  }
}

/** One row of `get_slot_prescription_history` (T707): a slot × session summary. */
function makeHistoryRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    workout_exercise_id: "we-1",
    exercise_id: "ex-1",
    session_id: "sess-1",
    session_finished_at: "2026-04-01T00:00:00Z",
    prescribed_reps: 10,
    anchor_reps: null,
    prescribed_weight: 50,
    avg_rir: 1,
    ...overrides,
  }
}

/** Dispatch the two RPCs by name so each test controls both payloads. */
function mockRpcBySlot({
  lastPerformance = [] as Record<string, unknown>[],
  history = [] as Record<string, unknown>[],
  lastPerformanceError = null as { message: string } | null,
  historyError = null as { message: string } | null,
} = {}) {
  rpcMock.mockImplementation((name: string) => {
    if (name === "get_last_performance_for_slots") {
      return Promise.resolve({
        data: lastPerformanceError ? null : lastPerformance,
        error: lastPerformanceError,
      })
    }
    if (name === "get_slot_prescription_history") {
      return Promise.resolve({
        data: historyError ? null : history,
        error: historyError,
      })
    }
    return Promise.resolve({ data: null, error: null })
  })
}

describe("requireParallelSlotArrays", () => {
  it("throws when parallel arrays differ in length", () => {
    expect(() =>
      requireParallelSlotArrays(["we-1", "we-2"], ["ex-1"]),
    ).toThrow(/length mismatch/)
  })

  it("does not throw when lengths match", () => {
    expect(() =>
      requireParallelSlotArrays(["we-1"], ["ex-1"]),
    ).not.toThrow()
  })
})

describe("useProgressionSuggestionsForDay", () => {
  beforeEach(() => {
    rpcMock.mockReset()
    batchMock.mockReset()
    batchMock.mockReturnValue({ data: [] })
  })

  // Cycle 9: batched RPC hook maps the new prescribed_* + session_finished_at
  // columns and threads them through buildPrescription. Mirrors the canonical
  // bug at the day-level layer. See ADR 0006.
  it("snapshot path: drifted exercise.reps does NOT trigger HOLD_INCOMPLETE when RPC returns clean prescribed_reps", async () => {
    rpcMock.mockResolvedValue({
      data: [
        makeRow({
          set_number: 1,
          prescribed_reps: 10,
          prescribed_weight: 50,
          prescribed_sets: 3,
          weight_logged: 50,
        }),
        makeRow({
          set_number: 2,
          prescribed_reps: 10,
          prescribed_weight: 50,
          prescribed_sets: 3,
          weight_logged: 50,
        }),
        makeRow({
          set_number: 3,
          prescribed_reps: 10,
          prescribed_weight: 50,
          prescribed_sets: 3,
          weight_logged: 50,
        }),
      ],
      error: null,
    })

    const exercise = makeExercise({
      reps: "11", // drifted post-bump
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z", // older than session_finished_at
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [exercise]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const suggestion = result.current.data.get("we-1")
    expect(suggestion).not.toBeNull()
    expect(suggestion!.rule).toBe("REPS_UP") // snapshot wins, NOT HOLD_INCOMPLETE
    expect(suggestion!.reps).toBe(11)
  })

  // ADR 0032 — the in-session anchor reaches the day-level suggestion.
  it("anchor path: the RPC's anchor_reps drives volume.current (in-session deload survives)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        makeRow({ set_number: 1, prescribed_reps: 10, anchor_reps: 10, reps_logged: "8" }),
        makeRow({ set_number: 2, prescribed_reps: 10, anchor_reps: 10, reps_logged: "8" }),
        makeRow({ set_number: 3, prescribed_reps: 10, anchor_reps: 8, reps_logged: "8" }),
      ],
      error: null,
    })

    const exercise = makeExercise({ reps: "10", weight: "80", sets: 3 })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [exercise]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const suggestion = result.current.data.get("we-1")
    // Without the anchor: prescribed 10 vs logged 8 → HOLD_INCOMPLETE.
    // With it: the target is 8, every set met → REPS_UP.
    expect(suggestion!.rule).toBe("REPS_UP")
  })

  it("returns an empty map and skips the RPC when exercises array is empty", () => {
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", []),
    )

    expect(result.current.data.size).toBe(0)
    expect(result.current.isLoading).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("computes a Progression Suggestion per exercise with last performance (happy path)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        makeRow({ set_number: 1 }),
        makeRow({ set_number: 2 }),
        makeRow({ set_number: 3 }),
      ],
      error: null,
    })

    const exercise = makeExercise({
      reps: "10",
      weight: "80",
      sets: 3,
      rep_range_min: 8,
      rep_range_max: 12,
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [exercise]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(rpcMock).toHaveBeenCalledWith("get_last_performance_for_slots", {
      p_workout_exercise_ids: ["we-1"],
      p_exercise_ids: ["ex-1"],
    })
    const suggestion = result.current.data.get("we-1")
    expect(suggestion).not.toBeNull()
    expect(suggestion!.rule).toBe("REPS_UP")
    expect(suggestion!.reps).toBe(11)
    expect(suggestion!.weight).toBe(80)
  })

  it("keeps independent Last Performance when two slots share a catalog exercise", async () => {
    // #463 repro: heavy gym slot vs light HIIT slot, same rowing catalog id.
    rpcMock.mockResolvedValue({
      data: [
        makeRow({
          workout_exercise_id: "we-heavy",
          exercise_id: "ex-rowing",
          weight_logged: 22,
          prescribed_weight: 22,
          prescribed_reps: 10,
          prescribed_sets: 3,
          set_number: 1,
        }),
        makeRow({
          workout_exercise_id: "we-heavy",
          exercise_id: "ex-rowing",
          weight_logged: 22,
          prescribed_weight: 22,
          prescribed_reps: 10,
          prescribed_sets: 3,
          set_number: 2,
        }),
        makeRow({
          workout_exercise_id: "we-heavy",
          exercise_id: "ex-rowing",
          weight_logged: 22,
          prescribed_weight: 22,
          prescribed_reps: 10,
          prescribed_sets: 3,
          set_number: 3,
        }),
        makeRow({
          workout_exercise_id: "we-light",
          exercise_id: "ex-rowing",
          weight_logged: 8,
          prescribed_weight: 8,
          prescribed_reps: 10,
          prescribed_sets: 3,
          set_number: 1,
          session_id: "sess-light",
        }),
        makeRow({
          workout_exercise_id: "we-light",
          exercise_id: "ex-rowing",
          weight_logged: 8,
          prescribed_weight: 8,
          prescribed_reps: 10,
          prescribed_sets: 3,
          set_number: 2,
          session_id: "sess-light",
        }),
        makeRow({
          workout_exercise_id: "we-light",
          exercise_id: "ex-rowing",
          weight_logged: 8,
          prescribed_weight: 8,
          prescribed_reps: 10,
          prescribed_sets: 3,
          set_number: 3,
          session_id: "sess-light",
        }),
      ],
      error: null,
    })

    const heavy = makeExercise({
      id: "we-heavy",
      exercise_id: "ex-rowing",
      weight: "22",
      reps: "10",
      sets: 3,
    })
    const light = makeExercise({
      id: "we-light",
      exercise_id: "ex-rowing",
      weight: "8",
      reps: "10",
      sets: 3,
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [heavy, light]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(rpcMock).toHaveBeenCalledWith("get_last_performance_for_slots", {
      p_workout_exercise_ids: ["we-heavy", "we-light"],
      p_exercise_ids: ["ex-rowing", "ex-rowing"],
    })

    const heavySug = result.current.data.get("we-heavy")
    const lightSug = result.current.data.get("we-light")
    expect(heavySug).not.toBeNull()
    expect(lightSug).not.toBeNull()
    expect(heavySug!.weight).toBe(22)
    expect(lightSug!.weight).toBe(8)
  })

  it("treats rows with duration_seconds set as a duration exercise", async () => {
    rpcMock.mockResolvedValue({
      data: [
        makeRow({
          workout_exercise_id: "we-plank",
          exercise_id: "ex-plank",
          set_number: 1,
          reps_logged: "0",
          weight_logged: 0,
          duration_seconds: 30,
        }),
        makeRow({
          workout_exercise_id: "we-plank",
          exercise_id: "ex-plank",
          set_number: 2,
          reps_logged: "0",
          weight_logged: 0,
          duration_seconds: 30,
        }),
        makeRow({
          workout_exercise_id: "we-plank",
          exercise_id: "ex-plank",
          set_number: 3,
          reps_logged: "0",
          weight_logged: 0,
          duration_seconds: 30,
        }),
      ],
      error: null,
    })

    const exercise = makeExercise({
      id: "we-plank",
      exercise_id: "ex-plank",
      reps: "0",
      weight: "0",
      sets: 3,
      target_duration_seconds: 30,
      duration_range_min_seconds: 20,
      duration_range_max_seconds: 45,
      duration_increment_seconds: 5,
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [exercise]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const suggestion = result.current.data.get("we-plank")
    expect(suggestion).not.toBeNull()
    expect(suggestion!.volumeType).toBe("duration")
    expect(suggestion!.rule).toBe("DURATION_UP")
    expect(suggestion!.duration).toBe(35)
  })

  it("yields a null entry for exercises without any last performance row", async () => {
    rpcMock.mockResolvedValue({
      data: [makeRow({ workout_exercise_id: "we-1", set_number: 1 })],
      error: null,
    })

    const exercises = [
      makeExercise({ id: "we-1", exercise_id: "ex-1" }),
      makeExercise({ id: "we-2", exercise_id: "ex-2" }),
      makeExercise({ id: "we-3", exercise_id: "ex-3" }),
    ]

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", exercises),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data.size).toBe(3)
    expect(result.current.data.get("we-1")).not.toBeNull()
    expect(result.current.data.get("we-2")).toBeNull()
    expect(result.current.data.get("we-3")).toBeNull()
  })

  it("exposes the RPC error and yields an empty map on failure", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [makeExercise()]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).not.toBeNull()
    expect(result.current.error!.message).toBe("permission denied")
    expect(result.current.data.size).toBe(0)
  })

  // T708 — the pre-session seam reads the slot's history and threads it into the
  // engine, so a Stall pre-fills the day list with the same lighter target as the
  // in-session seam (T707).
  it("serves a DELOAD pre-session when the slot's history is a Stall", async () => {
    mockRpcBySlot({
      lastPerformance: [
        makeRow({ set_number: 1, prescribed_reps: 10, prescribed_weight: 50, weight_logged: 50 }),
        makeRow({ set_number: 2, prescribed_reps: 10, prescribed_weight: 50, weight_logged: 50 }),
        makeRow({ set_number: 3, prescribed_reps: 10, prescribed_weight: 50, weight_logged: 50 }),
      ],
      history: Array.from({ length: 4 }, () => makeHistoryRow()),
    })

    const exercise = makeExercise({
      reps: "10",
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z", // older than session_finished_at
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [exercise]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const suggestion = result.current.data.get("we-1")
    expect(suggestion).not.toBeNull()
    expect(suggestion!.rule).toBe("DELOAD")
    expect(suggestion!.weight).toBe(47.5)
    expect(suggestion!.reps).toBe(10)
  })

  it("reads the slot history with a single RPC call for all slots of the day", async () => {
    mockRpcBySlot({
      lastPerformance: [makeRow({ workout_exercise_id: "we-1" })],
      history: [],
    })

    const exercises = [
      makeExercise({ id: "we-1", exercise_id: "ex-1" }),
      makeExercise({ id: "we-2", exercise_id: "ex-2" }),
      makeExercise({ id: "we-3", exercise_id: "ex-3" }),
    ]

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", exercises),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const historyCalls = rpcMock.mock.calls.filter(
      (call) => call[0] === "get_slot_prescription_history",
    )
    expect(historyCalls).toHaveLength(1)
    expect(historyCalls[0][1]).toMatchObject({
      p_workout_exercise_ids: ["we-1", "we-2", "we-3"],
      p_exercise_ids: ["ex-1", "ex-2", "ex-3"],
    })
  })

  // S4 — `before` frozen at mount goes stale and defeats cache reuse; omit it
  // and let the RPC default to now().
  it("omits p_before so the history RPC defaults to now()", async () => {
    mockRpcBySlot({ lastPerformance: [makeRow()], history: [] })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [makeExercise()]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const historyCall = rpcMock.mock.calls.find(
      (call) => call[0] === "get_slot_prescription_history",
    )!
    expect(historyCall[1]).not.toHaveProperty("p_before")
  })

  // B2 — the day seam must not compute a suggestion before the history settles:
  // fold the history query's loading state into the hook's own.
  it("stays loading while the slot history query is pending", async () => {
    let resolveHistory!: (value: unknown) => void
    rpcMock.mockImplementation((name: string) => {
      if (name === "get_last_performance_for_slots") {
        return Promise.resolve({ data: [makeRow()], error: null })
      }
      if (name === "get_slot_prescription_history") {
        return new Promise((resolve) => {
          resolveHistory = resolve
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [makeExercise()]),
    )

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "get_slot_prescription_history",
        expect.anything(),
      ),
    )
    expect(result.current.isLoading).toBe(true)

    resolveHistory({ data: [], error: null })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  // T708 — the increment must match the in-session seam: a dumbbell without an
  // explicit `weight_increment` resolves to 2.0 kg, not the 2.5 default.
  it("uses the catalog equipment so a dumbbell gets the in-session increment (2.0)", async () => {
    batchMock.mockReturnValue({
      data: [{ id: "ex-1", equipment: "dumbbell" }],
    })
    mockRpcBySlot({
      lastPerformance: [
        makeRow({ set_number: 1, reps_logged: "12", prescribed_reps: 12, prescribed_weight: 80, weight_logged: 80 }),
        makeRow({ set_number: 2, reps_logged: "12", prescribed_reps: 12, prescribed_weight: 80, weight_logged: 80 }),
        makeRow({ set_number: 3, reps_logged: "12", prescribed_reps: 12, prescribed_weight: 80, weight_logged: 80 }),
      ],
      history: [],
    })

    const exercise = makeExercise({
      reps: "10",
      weight: "80",
      sets: 3,
      rep_range_max: 12,
      max_weight_reached: false,
      template_updated_at: "2026-01-01T00:00:00Z",
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [exercise]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const suggestion = result.current.data.get("we-1")
    expect(suggestion).not.toBeNull()
    expect(suggestion!.rule).toBe("WEIGHT_UP")
    expect(suggestion!.weight).toBe(82.0) // 80 + 2.0, not 80 + 2.5
  })

  it("degrades to normal suggestions when the history RPC errors", async () => {
    mockRpcBySlot({
      lastPerformance: [
        makeRow({ set_number: 1, prescribed_reps: 10, prescribed_weight: 50, weight_logged: 50 }),
        makeRow({ set_number: 2, prescribed_reps: 10, prescribed_weight: 50, weight_logged: 50 }),
        makeRow({ set_number: 3, prescribed_reps: 10, prescribed_weight: 50, weight_logged: 50 }),
      ],
      historyError: { message: "function does not exist" },
    })

    const exercise = makeExercise({
      reps: "10",
      weight: "50",
      sets: 3,
      template_updated_at: "2026-01-01T00:00:00Z",
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestionsForDay("day-1", [exercise]),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const suggestion = result.current.data.get("we-1")
    expect(suggestion).not.toBeNull()
    expect(suggestion!.rule).not.toBe("DELOAD")
  })
})
