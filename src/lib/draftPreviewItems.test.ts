import { describe, expect, it } from "vitest"
import { formatDraftExerciseFallback, summarizeDraftExercises } from "./draftPreviewItems"

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

describe("formatDraftExerciseFallback (T189)", () => {
  it("renders AMRAP as AMRAP 20 min plus gloss, never naked AMRAP or rounds ?? 3", () => {
    const line = formatDraftExerciseFallback({
      type: "circuit",
      label: "Cindy",
      mode: "amrap",
      cap_minutes: 20,
      exercises: [
        { exercise_id: "x", amount: 5, weight_kg: 0 },
        { exercise_id: "y", amount: 10, weight_kg: 0 },
      ],
    })
    expect(line).toContain("AMRAP 20 min")
    expect(line).toMatch(/As many rounds as possible|Autant de tours que possible/)
    expect(line).not.toMatch(/AMRAP(?! \d+ min)/)
    expect(line).not.toContain("3 rounds")
  })
})
