import { describe, expect, it } from "vitest"
import { flattenProgramExercisePreview } from "./programExercisePreview"

describe("flattenProgramExercisePreview", () => {
  it("returns unique exercises in day then slot order", () => {
    expect(
      flattenProgramExercisePreview([
        {
          sort_order: 1,
          workout_exercises: [
            {
              exercise_id: "squat",
              name_snapshot: "Squat",
              emoji_snapshot: "🦵",
              sort_order: 0,
            },
          ],
          exercise_blocks: [],
        },
        {
          sort_order: 0,
          workout_exercises: [
            {
              exercise_id: "bench",
              name_snapshot: "Bench Press",
              emoji_snapshot: "🏋️",
              sort_order: 1,
            },
            {
              exercise_id: "row",
              name_snapshot: "Row",
              emoji_snapshot: "💪",
              sort_order: 0,
            },
            {
              exercise_id: "bench",
              name_snapshot: "Bench Press",
              emoji_snapshot: "🏋️",
              sort_order: 2,
            },
          ],
          exercise_blocks: [
            {
              sort_order: 3,
              exercises: [
                {
                  exercise_id: "pushup",
                  name_snapshot: "Push-up",
                  emoji_snapshot: "🔥",
                  position: 0,
                },
              ],
            },
          ],
        },
      ]),
    ).toEqual([
      { exerciseId: "row", name: "Row", emoji: "💪" },
      { exerciseId: "bench", name: "Bench Press", emoji: "🏋️" },
      { exerciseId: "pushup", name: "Push-up", emoji: "🔥" },
      { exerciseId: "squat", name: "Squat", emoji: "🦵" },
    ])
  })

  it("returns an empty list for a garbage payload", () => {
    expect(flattenProgramExercisePreview({ nope: true })).toEqual([])
    expect(flattenProgramExercisePreview(null)).toEqual([])
  })
})
