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
})
