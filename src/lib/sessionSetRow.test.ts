import { describe, it, expect } from "vitest"
import { buildInitialSetRowsForExercise, type SessionSetRowReps } from "./sessionSetRow"
import type { WorkoutExercise } from "@/types/database"

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
    ...overrides,
  }
}

describe("buildInitialSetRowsForExercise — safeReps fallback", () => {
  it("uses the reps value when it is a normal numeric string", () => {
    const rows = buildInitialSetRowsForExercise(makeExercise({ reps: "10" }), undefined, "80")
    expect(rows).toHaveLength(3)
    expect((rows[0] as SessionSetRowReps).reps).toBe("10")
  })

  it('falls back to "12" when reps is null', () => {
    const rows = buildInitialSetRowsForExercise(
      makeExercise({ reps: null as unknown as string }),
      undefined,
      "80",
    )
    expect((rows[0] as SessionSetRowReps).reps).toBe("12")
  })

  it('falls back to "12" when reps is the literal string "null"', () => {
    const rows = buildInitialSetRowsForExercise(makeExercise({ reps: "null" }), undefined, "80")
    expect((rows[0] as SessionSetRowReps).reps).toBe("12")
  })

  it('falls back to "12" when reps is the literal string "NaN"', () => {
    const rows = buildInitialSetRowsForExercise(makeExercise({ reps: "NaN" }), undefined, "80")
    expect((rows[0] as SessionSetRowReps).reps).toBe("12")
  })

  it("passes through an empty string (no sentinel match)", () => {
    const rows = buildInitialSetRowsForExercise(makeExercise({ reps: "" }), undefined, "80")
    expect((rows[0] as SessionSetRowReps).reps).toBe("")
  })

  it("creates the correct number of rows from exercise.sets", () => {
    const rows = buildInitialSetRowsForExercise(makeExercise({ sets: 5 }), undefined, "60")
    expect(rows).toHaveLength(5)
    for (const r of rows) {
      expect(r.kind).toBe("reps")
      expect(r.weight).toBe("60")
      expect(r.done).toBe(false)
    }
  })
})
