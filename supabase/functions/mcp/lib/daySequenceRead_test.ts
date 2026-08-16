import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  dbBlockToCircuitWire,
  slugFromBenchmarkEmbed,
  type DbBlockForRead,
} from "./daySequenceRead.ts"

const ID_A = "11111111-2222-4333-8444-555555555555"
const ID_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const FORK_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"

function makeBlock(overrides: Partial<DbBlockForRead> = {}): DbBlockForRead {
  return {
    id: "block-1",
    label: "Cindy",
    rounds: 1,
    rest_seconds: 0,
    transition_seconds: 0,
    sort_order: 0,
    mode: "amrap",
    cap_seconds: 1200,
    block_exercises: [
      {
        exercise_id: ID_A,
        name_snapshot: "Pull-up",
        position: 0,
        per_round: [{ amount: 5, weight: 0 }],
        exercises: { name: "Pull-up", name_en: "Pull-up" },
      },
      {
        exercise_id: ID_B,
        name_snapshot: "Push-up",
        position: 1,
        per_round: [{ amount: 10, weight: 0 }],
        exercises: { name: "Push-up", name_en: "Push-up" },
      },
    ],
    ...overrides,
  }
}

Deno.test("T195: seed echo keeps benchmark_slug cindy and omits a fake id", () => {
  const wire = dbBlockToCircuitWire(makeBlock({ benchmark_slug: "cindy" }))
  assertEquals(wire.benchmark_slug, "cindy")
  assertEquals(wire.benchmark_id, undefined)
})

Deno.test("T195: fork with NULL slug echoes benchmark_id, never a invented handle", () => {
  const wire = dbBlockToCircuitWire(
    makeBlock({ benchmark_slug: null, benchmark_circuit_id: FORK_ID }),
  )
  assertEquals(wire.benchmark_slug, undefined)
  assertEquals(wire.benchmark_id, FORK_ID)
})

Deno.test("T195: generic Zeus Circuit has no slug and no coerce on read", () => {
  const wire = dbBlockToCircuitWire(
    makeBlock({
      label: "Zeus",
      benchmark_slug: null,
      benchmark_circuit_id: null,
    }),
  )
  assertEquals("benchmark_slug" in wire, false)
  assertEquals("benchmark_id" in wire, false)
})

Deno.test("T195: slugFromBenchmarkEmbed ignores empty / array-wrapped null slugs", () => {
  assertEquals(slugFromBenchmarkEmbed({ slug: "cindy" }), "cindy")
  assertEquals(slugFromBenchmarkEmbed({ slug: null }), null)
  assertEquals(slugFromBenchmarkEmbed([{ slug: "  " }]), null)
  assertEquals(slugFromBenchmarkEmbed(null), null)
})
