import { describe, expect, it } from "vitest"
import { instantiateBenchmark } from "./instantiateBenchmark"
import type { BenchmarkCircuitLookup } from "./resolveBenchmark"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const PULL_ID = "11111111-1111-4111-8111-111111111111"
const PUSH_ID = "22222222-2222-4222-8222-222222222222"
const SQUAT_ID = "33333333-3333-4333-8333-333333333333"
const BURPEE_ID = "44444444-4444-4444-8444-444444444444"
const JUMP_SQUAT_ID = "55555555-5555-4555-8555-555555555555"

function makeCindy(): BenchmarkCircuitLookup {
  return {
    id: CINDY_ID,
    slug: "cindy",
    label: "Cindy",
    aliases: ["holland", "tom holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [
        { exercise_id: PULL_ID, amount: 5, weight: 0 },
        { exercise_id: PUSH_ID, amount: 10, weight: 0 },
        { exercise_id: SQUAT_ID, amount: 15, weight: 0 },
      ],
    },
  }
}

function exerciseCatalog() {
  return new Map([
    [PULL_ID, { id: PULL_ID, name: "Tractions", muscle_group: "Dos", emoji: "🚣" }],
    [PUSH_ID, { id: PUSH_ID, name: "Pompes", muscle_group: "Pectoraux", emoji: "🏋️" }],
    [SQUAT_ID, { id: SQUAT_ID, name: "Squat au poids du corps", muscle_group: "Quadriceps", emoji: "🦵" }],
    [BURPEE_ID, { id: BURPEE_ID, name: "Burpee", muscle_group: "Quadriceps", emoji: "🦵" }],
    [JUMP_SQUAT_ID, { id: JUMP_SQUAT_ID, name: "Squats sautés", muscle_group: "Quadriceps", emoji: "🦵" }],
  ])
}

describe("instantiateBenchmark", () => {
  it("copies catalog Rx onto a day block with Cindy label, AMRAP rest/transition 0, and stamped FK", () => {
    const { block, blockExercises } = instantiateBenchmark(makeCindy(), {
      workoutDayId: "day-1",
      sortOrder: 0,
      exerciseById: exerciseCatalog(),
    })

    expect(block).toEqual({
      workout_day_id: "day-1",
      label: "Cindy",
      rounds: 1,
      rest_seconds: 0,
      transition_seconds: 0,
      sort_order: 0,
      mode: "amrap",
      cap_seconds: 1200,
      benchmark_circuit_id: CINDY_ID,
    })
    expect(blockExercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      position: ex.position,
      per_round: ex.per_round,
      name_snapshot: ex.name_snapshot,
    }))).toEqual([
      { exercise_id: PULL_ID, position: 0, per_round: [{ amount: 5, weight: 0 }], name_snapshot: "Tractions" },
      { exercise_id: PUSH_ID, position: 1, per_round: [{ amount: 10, weight: 0 }], name_snapshot: "Pompes" },
      { exercise_id: SQUAT_ID, position: 2, per_round: [{ amount: 15, weight: 0 }], name_snapshot: "Squat au poids du corps" },
    ])
  })

  it("instantiates the canonical Zeus label, AMRAP cap, Rx, and catalog FK", () => {
    const zeus: BenchmarkCircuitLookup = {
      id: "zeus-id",
      slug: "zeus",
      label: "Zeus ⚡",
      aliases: [],
      rx: {
        mode: "amrap",
        cap_seconds: 1200,
        exercises: [
          { exercise_id: BURPEE_ID, amount: 5, weight: 0 },
          { exercise_id: JUMP_SQUAT_ID, amount: 10, weight: 0 },
          { exercise_id: PUSH_ID, amount: 15, weight: 0 },
        ],
      },
    }

    const { block, blockExercises } = instantiateBenchmark(zeus, {
      workoutDayId: "day-1",
      sortOrder: 0,
      exerciseById: exerciseCatalog(),
    })

    expect(block.label).toBe("Zeus ⚡")
    expect(block.mode).toBe("amrap")
    expect(block.cap_seconds).toBe(1200)
    expect(block.benchmark_circuit_id).toBe("zeus-id")
    expect(
      blockExercises.map(({ exercise_id, per_round, name_snapshot }) => ({
        exercise_id,
        per_round,
        name_snapshot,
      })),
    ).toEqual([
      {
        exercise_id: BURPEE_ID,
        per_round: [{ amount: 5, weight: 0 }],
        name_snapshot: "Burpee",
      },
      {
        exercise_id: JUMP_SQUAT_ID,
        per_round: [{ amount: 10, weight: 0 }],
        name_snapshot: "Squats sautés",
      },
      {
        exercise_id: PUSH_ID,
        per_round: [{ amount: 15, weight: 0 }],
        name_snapshot: "Pompes",
      },
    ])
  })

  it("fails clearly when any catalog exercise_id is missing — no half-Cindy", () => {
    const incomplete = new Map([
      [PULL_ID, { id: PULL_ID, name: "Tractions", muscle_group: "Dos", emoji: "🚣" }],
    ])
    expect(() =>
      instantiateBenchmark(makeCindy(), {
        workoutDayId: "day-1",
        sortOrder: 0,
        exerciseById: incomplete,
      }),
    ).toThrow(/missing exercise_id/)
  })
})
