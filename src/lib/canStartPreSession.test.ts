import { describe, expect, it } from "vitest"
import { canStartPreSession } from "@/lib/canStartPreSession"
import type { WorkoutExercise } from "@/types/database"

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
})
