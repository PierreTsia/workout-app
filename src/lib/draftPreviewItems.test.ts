import { describe, expect, it } from "vitest"
import { summarizeDraftExercises } from "./draftPreviewItems"

describe("summarizeDraftExercises (T169)", () => {
  it("counts bare UUIDs as solos only", () => {
    expect(summarizeDraftExercises(["a", "b", "c"])).toEqual({
      items: 3,
      solos: 3,
      circuits: 0,
    })
  })

  it("counts Circuits as one item each and reports the breakdown", () => {
    expect(
      summarizeDraftExercises([
        "solo-1",
        {
          type: "circuit",
          label: "Finisher",
          exercises: [
            { exercise_id: "x", amount: 10, weight_kg: 0 },
            { exercise_id: "y", amount: 8, weight_kg: 0 },
          ],
        },
        "solo-2",
      ]),
    ).toEqual({ items: 3, solos: 2, circuits: 1 })
  })
})
