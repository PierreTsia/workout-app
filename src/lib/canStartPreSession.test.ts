import { describe, expect, it } from "vitest"
import { canStartPreSession } from "@/lib/canStartPreSession"
import type {
  ExerciseBlockWithExercises,
  WorkoutExercise,
} from "@/types/database"

const block = (): ExerciseBlockWithExercises => ({
  id: "blk-1",
  workout_day_id: "d",
  label: "Circuit",
  rounds: 2,
  rest_seconds: 60,
  transition_seconds: 0,
  mode: "rounds",
  cap_seconds: null,
  sort_order: 0,
  created_at: "2020-01-01",
  exercises: [],
})

const minimal = (overrides: Partial<WorkoutExercise>): WorkoutExercise => ({
  id: "x",
  workout_day_id: "d",
  exercise_id: "e",
  name_snapshot: "n",
  muscle_snapshot: "m",
  emoji_snapshot: "🏋️",
  sets: 3,
  reps: "10",
  weight: "0",
  rest_seconds: 60,
  sort_order: 0,
  rep_range_min: 8,
  rep_range_max: 12,
  set_range_min: 2,
  set_range_max: 5,
  weight_increment: null,
  max_weight_reached: false,
  template_updated_at: "2020-01-01T00:00:00Z",
  ...overrides,
})

describe("canStartPreSession", () => {
  it("false when empty", () => {
    expect(canStartPreSession([])).toBe(false)
  })

  it("false when any exercise has zero sets", () => {
    expect(
      canStartPreSession([
        minimal({ id: "1", sets: 1 }),
        minimal({ id: "2", sets: 0 }),
      ]),
    ).toBe(false)
  })

  it("true when all have at least one set", () => {
    expect(
      canStartPreSession([
        minimal({ id: "1", sets: 1 }),
        minimal({ id: "2", sets: 3 }),
      ]),
    ).toBe(true)
  })

  it("true for a blocks-only day (no solo exercises)", () => {
    expect(canStartPreSession([], [block()])).toBe(true)
  })

  it("still false when a solo is invalid, even with blocks present", () => {
    expect(canStartPreSession([minimal({ sets: 0 })], [block()])).toBe(false)
  })
})
