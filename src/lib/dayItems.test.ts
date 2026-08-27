import { describe, it, expect } from "vitest"
import {
  applySortOrders,
  buildDayItems,
  dayItemId,
  moveDayItems,
  reorderDayItems,
} from "@/lib/dayItems"
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
    mode: "rounds",
    cap_seconds: null,
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

describe("reorderDayItems", () => {
  it("reindexes solos and blocks across the unified sequence when a block moves", () => {
    // sequence: solo s-a (0), block b-1 (1), solo s-b (2)
    const items = buildDayItems(
      [
        makeSolo({ id: "s-a", exercise_id: "ex-a", sort_order: 0 }),
        makeSolo({ id: "s-b", exercise_id: "ex-b", sort_order: 2 }),
      ],
      [makeBlock({ id: "b-1", sort_order: 1 })],
    )

    // drag the block (b-1) to the front (onto s-a)
    const { solos, blocks } = reorderDayItems(items, "b-1", "s-a")

    expect(blocks).toEqual([{ id: "b-1", sort_order: 0 }])
    expect(solos).toEqual([
      { id: "s-a", sort_order: 1 },
      { id: "s-b", sort_order: 2 },
    ])
  })

  it("returns empty updates when ids are not found", () => {
    const items = buildDayItems([makeSolo({ id: "s-a" })], [])
    expect(reorderDayItems(items, "nope", "s-a")).toEqual({
      solos: [],
      blocks: [],
    })
  })
})

describe("moveDayItems", () => {
  it("returns a new sequence with reindexed nested rows on drop", () => {
    const items = buildDayItems(
      [
        makeSolo({ id: "s-a", sort_order: 0 }),
        makeSolo({ id: "s-b", sort_order: 2 }),
      ],
      [makeBlock({ id: "b-1", sort_order: 1 })],
    )

    const next = moveDayItems(items, "b-1", "s-a")

    expect(next.map(dayItemId)).toEqual(["b-1", "s-a", "s-b"])
    expect(next.map((item) => item.sort_order)).toEqual([0, 1, 2])
    expect(next[0]).toMatchObject({
      kind: "block",
      block: { id: "b-1", sort_order: 0 },
    })
    expect(next[1]).toMatchObject({
      kind: "solo",
      exercise: { id: "s-a", sort_order: 1 },
    })
  })

  it("returns the same array when the drop is a no-op", () => {
    const items = buildDayItems([makeSolo({ id: "s-a" })], [])
    expect(moveDayItems(items, "s-a", "s-a")).toBe(items)
    expect(moveDayItems(items, "nope", "s-a")).toBe(items)
  })
})

describe("applySortOrders", () => {
  it("rewrites sort_order on matching ids and leaves the rest", () => {
    const rows = [
      makeSolo({ id: "s-a", sort_order: 0 }),
      makeSolo({ id: "s-b", sort_order: 1 }),
    ]

    expect(
      applySortOrders(rows, [
        { id: "s-a", sort_order: 1 },
        { id: "s-b", sort_order: 0 },
      ]).map((row) => [row.id, row.sort_order]),
    ).toEqual([
      ["s-a", 1],
      ["s-b", 0],
    ])
  })
})
