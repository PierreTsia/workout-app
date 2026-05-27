import { vi, describe, it, expect, beforeEach } from "vitest"
import { renderHookWithProviders } from "@/test/utils"
import { useProgressionSuggestion } from "./useProgressionSuggestion"
import type { WorkoutExercise } from "@/types/database"
import type { SetPerformance } from "@/lib/progression"

// ---------------------------------------------------------------------------
// Mock useLastSessionDetail — isolates from Supabase entirely
// ---------------------------------------------------------------------------

let mockLastPerformance: SetPerformance[] | null = null
let mockLastSessionFinishedAt = "2026-05-01T00:00:00Z"

vi.mock("@/hooks/useLastSessionDetail", () => ({
  useLastSessionDetail: () => ({
    data:
      mockLastPerformance == null
        ? null
        : {
            sets: mockLastPerformance,
            lastSessionFinishedAt: mockLastSessionFinishedAt,
          },
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makePerf(overrides: Partial<SetPerformance> = {}): SetPerformance {
  return { reps: 10, weight: 80, completed: true, rir: 2, ...overrides }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("useProgressionSuggestion", () => {
  beforeEach(() => {
    mockLastPerformance = null
  })

  it("returns a duration suggestion for duration exercises with history", () => {
    mockLastPerformance = [
      makePerf({ reps: 0, durationSeconds: 30 }),
      makePerf({ reps: 0, durationSeconds: 30 }),
      makePerf({ reps: 0, durationSeconds: 30 }),
    ]
    const ex = makeExercise({
      target_duration_seconds: 30,
      duration_range_min_seconds: 20,
      duration_range_max_seconds: 45,
      duration_increment_seconds: 5,
      max_weight_reached: true,
    })
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(ex, "duration"),
    )
    expect(result.current).not.toBeNull()
    expect(result.current!.volumeType).toBe("duration")
    expect(result.current!.rule).toBe("DURATION_UP")
    expect(result.current!.duration).toBe(35)
  })

  it("returns null when lastPerformance is null (no prior session)", () => {
    mockLastPerformance = null
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(makeExercise(), "reps"),
    )
    expect(result.current).toBeNull()
  })

  it("returns null when lastPerformance is empty", () => {
    mockLastPerformance = []
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(makeExercise(), "reps"),
    )
    expect(result.current).toBeNull()
  })

  it("infers currentReps from lastPerformance when exercise.reps is NaN", () => {
    mockLastPerformance = [makePerf({ reps: 8 }), makePerf({ reps: 8 }), makePerf({ reps: 8 })]
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(makeExercise({ reps: "abc" }), "reps"),
    )
    expect(result.current).not.toBeNull()
    expect(result.current!.reps).toBeGreaterThanOrEqual(8)
  })

  it("returns null when exercise.reps is NaN and inferred reps is 0", () => {
    mockLastPerformance = [makePerf({ reps: 0 })]
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(makeExercise({ reps: "abc" }), "reps"),
    )
    expect(result.current).toBeNull()
  })

  it("derives currentWeight from lastPerformance when positive", () => {
    mockLastPerformance = [makePerf({ reps: 10, weight: 90 }), makePerf({ reps: 10, weight: 90 }), makePerf({ reps: 10, weight: 90 })]
    const ex = makeExercise({ weight: "50" })
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(ex, "reps"),
    )
    expect(result.current).not.toBeNull()
    // All sets at max reps with positive last session weight → WEIGHT_UP from 90
    expect(result.current!.rule).toBe("REPS_UP")
    expect(result.current!.weight).toBe(90)
  })

  it("falls back to template weight when lastPerformance weight is 0", () => {
    mockLastPerformance = [makePerf({ reps: 12, weight: 0 }), makePerf({ reps: 12, weight: 0 }), makePerf({ reps: 12, weight: 0 })]
    const ex = makeExercise({ weight: "50", max_weight_reached: false })
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(ex, "reps"),
    )
    expect(result.current).not.toBeNull()
    // All at repRangeMax(12), not maxWeight → WEIGHT_UP
    expect(result.current!.rule).toBe("WEIGHT_UP")
    expect(result.current!.weight).toBe(50 + 2.5)
  })

  it("uses default ranges when rep_range_min/max are undefined (pre-migration)", () => {
    mockLastPerformance = [makePerf({ reps: 10 }), makePerf({ reps: 10 }), makePerf({ reps: 10 })]
    const ex = makeExercise({
      reps: "10",
      rep_range_min: undefined,
      rep_range_max: undefined,
      set_range_min: undefined,
      set_range_max: undefined,
    })
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(ex, "reps"),
    )
    expect(result.current).not.toBeNull()
    // Fallback: repRangeMax = 10 + 2 = 12. currentReps=10, all hit 10 >= 10 → allHitTargetReps
    // But allAtMaxReps: 10 >= 12? No → REPS_UP
    expect(result.current!.rule).toBe("REPS_UP")
    expect(result.current!.reps).toBe(11)
  })

  it("uses dumbbell increment (2.0) when equipment is dumbbell", () => {
    mockLastPerformance = [makePerf({ reps: 12 }), makePerf({ reps: 12 }), makePerf({ reps: 12 })]
    const ex = makeExercise({ max_weight_reached: false })
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(ex, "reps", "dumbbell"),
    )
    expect(result.current).not.toBeNull()
    expect(result.current!.rule).toBe("WEIGHT_UP")
    expect(result.current!.weight).toBe(80 + 2.0)
  })

  it("returns REPS_UP on a happy path with room in rep range", () => {
    mockLastPerformance = [makePerf({ reps: 10 }), makePerf({ reps: 10 }), makePerf({ reps: 10 })]
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(makeExercise(), "reps"),
    )
    expect(result.current).not.toBeNull()
    expect(result.current!.rule).toBe("REPS_UP")
    expect(result.current!.reps).toBe(11)
    expect(result.current!.sets).toBe(3)
    expect(result.current!.weight).toBe(80)
  })

  // Cycle 8: hook threads lastSessionFinishedAt + prescribed_* through to
  // buildPrescription, so a drifted exercise.reps doesn't poison the engine.
  // Mirrors the canonical bug at the hook layer. See ADR 0006.
  it("snapshot path: drifted exercise.reps does NOT trigger HOLD_INCOMPLETE when snapshot is clean", () => {
    mockLastPerformance = [
      makePerf({ reps: 10, weight: 50, prescribedReps: 10, prescribedWeight: 50, prescribedSets: 3 }),
      makePerf({ reps: 10, weight: 50, prescribedReps: 10, prescribedWeight: 50, prescribedSets: 3 }),
      makePerf({ reps: 10, weight: 50, prescribedReps: 10, prescribedWeight: 50, prescribedSets: 3 }),
    ]
    mockLastSessionFinishedAt = "2026-05-01T00:00:00Z"
    const ex = makeExercise({
      reps: "11", // simulates drifted post-bump or legacy template
      weight: "50",
      template_updated_at: "2026-01-01T00:00:00Z", // older than last session
    })

    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(ex, "reps"),
    )

    expect(result.current).not.toBeNull()
    expect(result.current!.rule).toBe("REPS_UP")
    expect(result.current!.reps).toBe(11)
  })

  it("returns HOLD_INCOMPLETE when not all sets were completed", () => {
    mockLastPerformance = [
      makePerf({ reps: 10, completed: true }),
      makePerf({ reps: 10, completed: false }),
      makePerf({ reps: 10, completed: true }),
    ]
    const { result } = renderHookWithProviders(() =>
      useProgressionSuggestion(makeExercise(), "reps"),
    )
    expect(result.current).not.toBeNull()
    expect(result.current!.rule).toBe("HOLD_INCOMPLETE")
  })
})
