import { describe, expect, it } from "vitest"
import { buildCircuitInsertRows } from "./blockPersistence"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type { ParsedExercise } from "./createProgramValidation"

const ID_A = "11111111-2222-4333-8444-555555555555"
const ID_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function catalog(): Map<string, CatalogExerciseForProgram> {
  return new Map([
    [
      ID_A,
      {
        id: ID_A,
        name: "Burpee",
        muscle_group: "Full Body",
        emoji: "💥",
        equipment: "bodyweight",
        measurement_type: "reps",
        default_duration_seconds: null,
      },
    ],
    [
      ID_B,
      {
        id: ID_B,
        name: "KB Swing",
        muscle_group: "Posterior Chain",
        emoji: "🔔",
        equipment: "kettlebell",
        measurement_type: "reps",
        default_duration_seconds: null,
      },
    ],
  ])
}

describe("buildCircuitInsertRows (T163)", () => {
  it("propagates flat amount/weight_kg across all rounds as DB weight cells", () => {
    const circuit: Extract<ParsedExercise, { kind: "circuit" }> = {
      kind: "circuit",
      label: "Finisher",
      rounds: 3,
      restSeconds: 90,
      transitionSeconds: 0,
      exercises: [
        { mode: "flat", exerciseId: ID_A, amount: 10, weightKg: 0 },
        { mode: "flat", exerciseId: ID_B, amount: 12, weightKg: 16 },
      ],
    }
    const { block, blockExercises } = buildCircuitInsertRows(
      "day-1",
      2,
      circuit,
      catalog(),
    )
    expect(block).toMatchObject({
      workout_day_id: "day-1",
      label: "Finisher",
      rounds: 3,
      rest_seconds: 90,
      transition_seconds: 0,
      sort_order: 2,
    })
    expect(blockExercises[0].per_round).toEqual([
      { amount: 10, weight: 0 },
      { amount: 10, weight: 0 },
      { amount: 10, weight: 0 },
    ])
    expect(blockExercises[1].per_round).toEqual([
      { amount: 12, weight: 16 },
      { amount: 12, weight: 16 },
      { amount: 12, weight: 16 },
    ])
    expect(blockExercises[0].name_snapshot).toBe("Burpee")
  })

  it("keeps per_round cells as-is (weight_kg → weight)", () => {
    const circuit: Extract<ParsedExercise, { kind: "circuit" }> = {
      kind: "circuit",
      label: null,
      rounds: 2,
      restSeconds: 60,
      transitionSeconds: 15,
      exercises: [
        {
          mode: "per_round",
          exerciseId: ID_A,
          perRound: [
            { amount: 20, weightKg: 0 },
            { amount: 15, weightKg: 0 },
          ],
        },
        { mode: "flat", exerciseId: ID_B, amount: 10, weightKg: 0 },
      ],
    }
    const { blockExercises } = buildCircuitInsertRows("day-1", 0, circuit, catalog())
    expect(blockExercises[0].per_round).toEqual([
      { amount: 20, weight: 0 },
      { amount: 15, weight: 0 },
    ])
  })
})
