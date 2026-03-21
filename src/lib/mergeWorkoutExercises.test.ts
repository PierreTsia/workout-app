import { describe, expect, it } from "vitest"
import { mergeWorkoutExercises } from "@/lib/mergeWorkoutExercises"
import type { PreSessionExercisePatch } from "@/types/preSessionOverrides"
import type { WorkoutExercise } from "@/types/database"

function row(
  partial: Partial<WorkoutExercise> & Pick<WorkoutExercise, "id" | "sort_order">,
): WorkoutExercise {
  return {
    workout_day_id: "d1",
    exercise_id: "e1",
    name_snapshot: "A",
    muscle_snapshot: "m",
    emoji_snapshot: "🏋️",
    sets: 3,
    reps: "10",
    weight: "0",
    rest_seconds: 60,
    ...partial,
  }
}

describe("mergeWorkoutExercises", () => {
  it("returns base when patch empty", () => {
    const base = [row({ id: "1", sort_order: 0 })]
    const patch: PreSessionExercisePatch = {
      deletedIds: new Set(),
      swappedRows: new Map(),
      addedRows: [],
    }
    expect(mergeWorkoutExercises(base, patch)).toEqual(base)
  })

  it("removes deleted ids", () => {
    const base = [
      row({ id: "1", sort_order: 0 }),
      row({ id: "2", sort_order: 1 }),
    ]
    const patch: PreSessionExercisePatch = {
      deletedIds: new Set(["1"]),
      swappedRows: new Map(),
      addedRows: [],
    }
    expect(mergeWorkoutExercises(base, patch)).toEqual([base[1]])
  })

  it("replaces swapped rows", () => {
    const base = [row({ id: "1", sort_order: 0, name_snapshot: "Old" })]
    const swapped = row({
      id: "1",
      sort_order: 0,
      exercise_id: "e2",
      name_snapshot: "New",
    })
    const patch: PreSessionExercisePatch = {
      deletedIds: new Set(),
      swappedRows: new Map([["1", swapped]]),
      addedRows: [],
    }
    expect(mergeWorkoutExercises(base, patch)).toEqual([swapped])
  })

  it("appends added and sorts by sort_order", () => {
    const base = [row({ id: "1", sort_order: 1 })]
    const added = row({ id: "2", sort_order: 0, name_snapshot: "B" })
    const patch: PreSessionExercisePatch = {
      deletedIds: new Set(),
      swappedRows: new Map(),
      addedRows: [added],
    }
    expect(mergeWorkoutExercises(base, patch).map((r) => r.id)).toEqual([
      "2",
      "1",
    ])
  })
})
