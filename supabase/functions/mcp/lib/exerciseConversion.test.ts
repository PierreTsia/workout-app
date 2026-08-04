import { describe, expect, it } from "vitest"
import { collectCandidateExerciseIds } from "./exerciseConversion"

const ID_A = "11111111-2222-4333-8444-555555555555"
const ID_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const ID_C = "cccccccc-dddd-4eee-8fff-000000000000"

describe("collectCandidateExerciseIds (T163 Circuits)", () => {
  it("collects nested exercise_ids from type:circuit items", () => {
    const ids = collectCandidateExerciseIds([
      ID_A,
      {
        type: "circuit",
        exercises: [
          { exercise_id: ID_B, amount: 10, weight_kg: 0 },
          { exercise_id: ID_C, amount: 12, weight_kg: 16 },
        ],
      },
    ])
    expect(ids).toEqual([ID_A, ID_B, ID_C])
  })

  it("still collects top-level solo exercise_id objects", () => {
    const ids = collectCandidateExerciseIds([
      { exercise_id: ID_A, sets: 3, reps: "8", weight_kg: 60, rest_seconds: 90 },
    ])
    expect(ids).toEqual([ID_A])
  })
})
