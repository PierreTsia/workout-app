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
        },
      ],
      [
        {
          id: "blk-1",
          label: "Force Haut",
          rounds: 4,
          sort_order: 0,
          exercises: [
            { id: "be-1", position: 0 },
            { id: "be-2", position: 1 },
          ],
        },
      ],
    )

    expect(items.map((item) => item.id)).toEqual(["blk-1", "we-1"])
    expect(items[0]).toMatchObject({
      kind: "circuit",
      label: "Force Haut",
      rounds: 4,
      exerciseCount: 2,
    })
    expect(items[1]).toMatchObject({
      kind: "solo",
      name: "Plank",
      sets: 3,
    })
  })
})
