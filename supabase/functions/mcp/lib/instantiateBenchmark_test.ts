import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { instantiateBenchmark } from "./instantiateBenchmark.ts"
import type { BenchmarkCircuitLookup } from "./resolveBenchmark.ts"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const PULL_ID = "11111111-1111-4111-8111-111111111111"
const PUSH_ID = "22222222-2222-4222-8222-222222222222"
const SQUAT_ID = "33333333-3333-4333-8333-333333333333"

function makeCindy(): BenchmarkCircuitLookup {
  return {
    id: CINDY_ID,
    slug: "cindy",
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
  ])
}

Deno.test("instantiateBenchmark copies Cindy Rx and stamps the catalog FK", () => {
  const { block, blockExercises } = instantiateBenchmark(makeCindy(), {
    workoutDayId: "day-1",
    sortOrder: 0,
    exerciseById: exerciseCatalog(),
  })
  assertEquals(block.benchmark_circuit_id, CINDY_ID)
  assertEquals(block.label, "Cindy")
  assertEquals(block.mode, "amrap")
  assertEquals(block.cap_seconds, 1200)
  assertEquals(block.rest_seconds, 0)
  assertEquals(block.transition_seconds, 0)
  assertEquals(blockExercises.map((ex) => ex.per_round[0]?.amount), [5, 10, 15])
})

Deno.test("instantiateBenchmark throws when an rx exercise is missing", () => {
  assertThrows(
    () =>
      instantiateBenchmark(makeCindy(), {
        workoutDayId: "day-1",
        sortOrder: 0,
        exerciseById: new Map(),
      }),
    Error,
    "missing exercise_id",
  )
})
