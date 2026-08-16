import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { resolveBenchmark, type BenchmarkCircuitLookup } from "./resolveBenchmark.ts"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function makeCindy(overrides: Partial<BenchmarkCircuitLookup> = {}): BenchmarkCircuitLookup {
  return {
    id: CINDY_ID,
    slug: "cindy",
    label: "Cindy",
    aliases: ["holland", "tom holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [
        { exercise_id: "ex-pull", amount: 5, weight: 0 },
        { exercise_id: "ex-push", amount: 10, weight: 0 },
        { exercise_id: "ex-squat", amount: 15, weight: 0 },
      ],
    },
    ...overrides,
  }
}

Deno.test("resolveBenchmark finds a seed by slug, alias, or id", () => {
  const catalog = [makeCindy()]
  assertEquals(resolveBenchmark(catalog, { slug: "  Cindy  " })?.id, CINDY_ID)
  assertEquals(resolveBenchmark(catalog, { label: "Holland" })?.id, CINDY_ID)
  assertEquals(resolveBenchmark(catalog, { id: CINDY_ID })?.slug, "cindy")
})

Deno.test("resolveBenchmark returns null for an unknown slug", () => {
  assertEquals(resolveBenchmark([makeCindy()], { slug: "not-a-wod" }), null)
})
