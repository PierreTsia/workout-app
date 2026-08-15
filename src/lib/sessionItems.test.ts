import { describe, expect, it } from "vitest"
import { buildSessionItems, sessionItemId } from "@/lib/sessionItems"
import type {
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"

function solo(id: string, sortOrder: number): WorkoutExerciseWithLabel {
  return {
    id,
    workout_day_id: "day-1",
    exercise_id: `lib-${id}`,
    exercise: null,
    name_snapshot: id,
    muscle_snapshot: "chest",
    emoji_snapshot: "💪",
    sets: 3,
    reps: "10",
    weight: "0",
    rest_seconds: 90,
    sort_order: sortOrder,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    template_updated_at: "2020-01-01T00:00:00Z",
  }
}

function block(id: string, sortOrder: number): ExerciseBlockWithExercises {
  return {
    id,
    workout_day_id: "day-1",
    label: id,
    rounds: 3,
    rest_seconds: 60,
    transition_seconds: 0,
    mode: "rounds",
    cap_seconds: null,
    sort_order: sortOrder,
    created_at: "2020-01-01",
    exercises: [],
  }
}

describe("buildSessionItems", () => {
  it("interleaves solos and blocks by their shared sort_order", () => {
    const items = buildSessionItems(
      [solo("A", 0), solo("C", 2)],
      [block("B", 1)],
    )

    expect(items.map(sessionItemId)).toEqual(["A", "B", "C"])
    expect(items.map((i) => i.kind)).toEqual(["solo", "block", "solo"])
  })

  it("keeps stable order when sort_orders collide (solos before blocks)", () => {
    const items = buildSessionItems([solo("A", 0)], [block("B", 0)])
    expect(items.map(sessionItemId)).toEqual(["A", "B"])
  })

  it("returns solos-only and blocks-only sequences unchanged", () => {
    expect(buildSessionItems([solo("A", 0)], []).map(sessionItemId)).toEqual([
      "A",
    ])
    expect(buildSessionItems([], [block("B", 0)]).map(sessionItemId)).toEqual([
      "B",
    ])
  })
})
