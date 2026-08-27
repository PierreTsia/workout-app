import { describe, expect, it } from "vitest"
import { toDayCardItems } from "./toDayCardItems"

describe("toDayCardItems", () => {
  it("interleaves solos and circuits by sort order", () => {
    const items = toDayCardItems(
      [
        {
          id: "we-1",
          emoji_snapshot: "🔥",
          name_snapshot: "Plank",
          sets: 3,
          reps: "0",
          rest_seconds: 30,
          sort_order: 1,
          exercise_id: "ex-plank",
        },
      ],
      [
        {
          id: "blk-1",
          label: "Force Haut",
          rounds: 4,
          sort_order: 0,
          exercises: [
            {
              id: "be-1",
              position: 0,
              exercise_id: "ex-pull",
              name_snapshot: "Tractions",
              emoji_snapshot: "🏋️",
              per_round: [{ amount: 5 }],
            },
            {
              id: "be-2",
              position: 1,
              exercise_id: "ex-push",
              name_snapshot: "Pompes",
              emoji_snapshot: "💪",
              per_round: [{ amount: 10 }],
              exercise: { measurement_type: "reps" },
            },
            {
              id: "be-3",
              position: 2,
              exercise_id: "ex-hold",
              name_snapshot: "Hollow hold",
              emoji_snapshot: "🔥",
              per_round: [{ amount: 30 }],
              exercise: { measurement_type: "duration" },
            },
          ],
        },
      ],
    )

    expect(items.map((item) => item.id)).toEqual(["blk-1", "we-1"])
    expect(items[0]).toMatchObject({
      kind: "circuit",
      label: "Force Haut",
      rounds: 4,
      exerciseCount: 3,
      stations: [
        {
          id: "be-1",
          name: "Tractions",
          exerciseId: "ex-pull",
          amounts: [5],
          isDuration: false,
        },
        {
          id: "be-2",
          name: "Pompes",
          exerciseId: "ex-push",
          amounts: [10],
          isDuration: false,
        },
        {
          id: "be-3",
          name: "Hollow hold",
          exerciseId: "ex-hold",
          amounts: [30],
          isDuration: true,
        },
      ],
    })
    expect(items[1]).toMatchObject({
      kind: "solo",
      name: "Plank",
      sets: 3,
      exerciseId: "ex-plank",
    })
  })
})
