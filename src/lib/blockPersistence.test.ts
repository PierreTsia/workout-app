import { describe, it, expect } from "vitest"
import {
  buildAmrapPersistPayload,
  buildBlockInsertRows,
  buildGeneratedCircuitInsertRows,
} from "@/lib/blockPersistence"
import type { ExerciseListItem } from "@/types/database"
import type { GeneratedCircuit } from "@/types/generator"

function makeLibExercise(
  overrides: Partial<ExerciseListItem> = {},
): ExerciseListItem {
  return {
    id: "ex-1",
    name: "Burpee",
    name_en: "Burpee",
    emoji: "🔥",
    muscle_group: "full",
    equipment: "bodyweight",
    image_url: null,
    difficulty_level: "intermediate",
    is_system: true,
    measurement_type: "reps",
    default_duration_seconds: null,
    secondary_muscles: null,
    ...overrides,
  }
}

describe("buildBlockInsertRows", () => {
  it("builds per_round of length rounds with catalog-derived defaults", () => {
    const reps = makeLibExercise({ id: "reps-ex", measurement_type: "reps" })
    const hold = makeLibExercise({
      id: "hold-ex",
      measurement_type: "duration",
      default_duration_seconds: 45,
    })

    const { blockExercises } = buildBlockInsertRows({
      dayId: "day-1",
      libraryExercises: [reps, hold],
      existingMaxSortOrder: -1,
      rounds: 3,
    })

    const repsRows = blockExercises[0].per_round
    const holdRows = blockExercises[1].per_round
    expect(repsRows).toHaveLength(3)
    expect(holdRows).toHaveLength(3)
    expect(repsRows.every((c) => c.amount === 10 && c.weight === 0)).toBe(true)
    expect(holdRows.every((c) => c.amount === 45 && c.weight === 0)).toBe(true)
  })

  it("places the block after existing items and sequences exercises with catalog snapshots", () => {
    const a = makeLibExercise({
      id: "ex-a",
      name: "Lunge",
      muscle_group: "legs",
      emoji: "🦵",
    })
    const b = makeLibExercise({ id: "ex-b", name: "Push-up", emoji: undefined })

    const { block, blockExercises } = buildBlockInsertRows({
      dayId: "day-1",
      libraryExercises: [a, b],
      existingMaxSortOrder: 4,
    })

    expect(block.sort_order).toBe(5)
    expect(block.workout_day_id).toBe("day-1")
    expect(block.mode).toBe("rounds")
    expect(block.cap_seconds).toBeNull()
    expect(blockExercises.map((e) => e.position)).toEqual([0, 1])
    expect(blockExercises[0]).toMatchObject({
      exercise_id: "ex-a",
      name_snapshot: "Lunge",
      muscle_snapshot: "legs",
      emoji_snapshot: "🦵",
    })
    expect(blockExercises[1].emoji_snapshot).toBe("🏋️")
  })
})

describe("buildAmrapPersistPayload", () => {
  it("persists Cindy as AMRAP 20 min with a length-1 template", () => {
    const cindy = [
      {
        id: "be-pull",
        per_round: [
          { amount: 5, weight: 0 },
          { amount: 5, weight: 0 },
        ],
      },
      { id: "be-push", per_round: [{ amount: 10, weight: 0 }] },
      { id: "be-squat", per_round: [{ amount: 15, weight: 0 }] },
    ]

    const { block, exercises } = buildAmrapPersistPayload(20, cindy)

    expect(block).toEqual({
      mode: "amrap",
      cap_seconds: 1200,
      rounds: 1,
      rest_seconds: 0,
      transition_seconds: 0,
    })
    expect(exercises.map((e) => e.per_round)).toEqual([
      [{ amount: 5, weight: 0 }],
      [{ amount: 10, weight: 0 }],
      [{ amount: 15, weight: 0 }],
    ])
  })
})

describe("buildGeneratedCircuitInsertRows", () => {
  it("keeps a Tours preview as rounds with no cap", () => {
    const burpee = makeLibExercise({ id: "ex-1", name: "Burpee" })
    const circuit: GeneratedCircuit = {
      label: "Finisher",
      rounds: 3,
      restSeconds: 90,
      transitionSeconds: 20,
      exercises: [{ exercise: burpee, amount: 10, weightKg: 0 }],
    }

    const { block, blockExercises } = buildGeneratedCircuitInsertRows(
      "day-1",
      0,
      circuit,
    )

    expect(block).toMatchObject({
      mode: "rounds",
      cap_seconds: null,
      rounds: 3,
      rest_seconds: 90,
      transition_seconds: 20,
    })
    expect(blockExercises[0].per_round).toHaveLength(3)
  })

  it("persists a generated Cindy as AMRAP, not Tours with a dropped cap", () => {
    const pull = makeLibExercise({
      id: "ex-pull",
      name: "Pull-up",
      equipment: "bodyweight",
    })
    const push = makeLibExercise({
      id: "ex-push",
      name: "Push-up",
      equipment: "bodyweight",
    })
    const squat = makeLibExercise({
      id: "ex-squat",
      name: "Squat",
      equipment: "bodyweight",
    })
    const circuit: GeneratedCircuit = {
      label: "Cindy",
      mode: "amrap",
      capMinutes: 20,
      rounds: 3,
      restSeconds: 90,
      transitionSeconds: 20,
      exercises: [
        { exercise: pull, amount: 5, weightKg: 0 },
        { exercise: push, amount: 10, weightKg: 0 },
        { exercise: squat, amount: 15, weightKg: 0 },
      ],
    }

    const { block, blockExercises } = buildGeneratedCircuitInsertRows(
      "day-1",
      2,
      circuit,
    )

    expect(block).toMatchObject({
      workout_day_id: "day-1",
      label: "Cindy",
      sort_order: 2,
      mode: "amrap",
      cap_seconds: 1200,
      rounds: 1,
      rest_seconds: 0,
      transition_seconds: 0,
    })
    expect(blockExercises.map((row) => row.per_round)).toEqual([
      [{ amount: 5, weight: 0 }],
      [{ amount: 10, weight: 0 }],
      [{ amount: 15, weight: 0 }],
    ])
  })
})
