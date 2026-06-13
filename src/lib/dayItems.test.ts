import { describe, it, expect } from "vitest"
import { buildDayItems } from "@/lib/dayItems"
import type {
  WorkoutExerciseWithExercise,
  ExerciseBlockWithExercises,
} from "@/types/database"

function makeSolo(
  overrides: Partial<WorkoutExerciseWithExercise> = {},
): WorkoutExerciseWithExercise {
  return {
    id: "solo-1",
    workout_day_id: "day-1",
    exercise_id: "ex-1",
    name_snapshot: "Squat",
    muscle_snapshot: "legs",
    emoji_snapshot: "🦵",
    sets: 3,
    reps: "10",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    template_updated_at: "1970-01-01T00:00:00Z",
    exercise: null,
    ...overrides,
  }
}

function makeBlock(
  overrides: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises {
  return {
    id: "block-1",
    workout_day_id: "day-1",
    label: null,
    rounds: 3,
    rest_seconds: 90,
    transition_seconds: 0,
    sort_order: 1,
    created_at: "1970-01-01T00:00:00Z",
    exercises: [],
    ...overrides,
  }
}

describe("buildDayItems", () => {
  it("merges solos and blocks into one sequence sorted by sort_order", () => {
    const solos = [
      makeSolo({ id: "s-a", sort_order: 2 }),
      makeSolo({ id: "s-b", sort_order: 0 }),
    ]
    const blocks = [makeBlock({ id: "b-a", sort_order: 1 })]

    const items = buildDayItems(solos, blocks)

    expect(items.map((i) => i.sort_order)).toEqual([0, 1, 2])
    expect(items.map((i) => i.kind)).toEqual(["solo", "block", "solo"])
  })

  it("exposes the solo's exercise and the block's exercises ordered by position", () => {
    const solo = makeSolo({ id: "s-1", sort_order: 0 })
    const block = makeBlock({
      id: "b-1",
      sort_order: 1,
      exercises: [
        {
          id: "be-2",
          block_id: "b-1",
          exercise_id: "ex-2",
          name_snapshot: "Push-up",
          muscle_snapshot: "chest",
          emoji_snapshot: "💪",
          position: 1,
          per_round: [{ amount: 10, weight: 0 }],
          exercise: null,
        },
        {
          id: "be-1",
          block_id: "b-1",
          exercise_id: "ex-1",
          name_snapshot: "Burpee",
          muscle_snapshot: "full",
          emoji_snapshot: "🔥",
          position: 0,
          per_round: [{ amount: 10, weight: 0 }],
          exercise: null,
        },
      ],
    })

    const items = buildDayItems([solo], [block])

    const soloItem = items[0]
    const blockItem = items[1]
    expect(soloItem).toMatchObject({ kind: "solo", exercise: { id: "s-1" } })
    expect(blockItem.kind).toBe("block")
    if (blockItem.kind !== "block") throw new Error("expected block item")
    expect(blockItem.block.exercises.map((e) => e.position)).toEqual([0, 1])
    expect(blockItem.block.exercises.map((e) => e.name_snapshot)).toEqual([
      "Burpee",
      "Push-up",
    ])
  })
})
