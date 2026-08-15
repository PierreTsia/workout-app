import { describe, expect, it } from "vitest"
import {
  collectReferencedBenchmarkExerciseIds,
  resolveBenchmark,
  type BenchmarkCircuitLookup,
} from "./resolveBenchmark"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function makeCindy(overrides: Partial<BenchmarkCircuitLookup> = {}): BenchmarkCircuitLookup {
  return {
    id: CINDY_ID,
    slug: "cindy",
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

describe("resolveBenchmark", () => {
  it("finds a seed by slug, ignoring case and surrounding whitespace", () => {
    const found = resolveBenchmark([makeCindy()], { slug: "  Cindy  " })
    expect(found?.id).toBe(CINDY_ID)
    expect(found?.slug).toBe("cindy")
  })

  it("finds a seed by alias (holland / tom holland), ignoring case and trim", () => {
    const catalog = [makeCindy()]
    expect(resolveBenchmark(catalog, { label: "Holland" })?.id).toBe(CINDY_ID)
    expect(resolveBenchmark(catalog, { label: "  TOM HOLLAND  " })?.id).toBe(CINDY_ID)
  })

  it("finds a seed by catalog id", () => {
    expect(resolveBenchmark([makeCindy()], { id: CINDY_ID })?.slug).toBe("cindy")
  })

  it("returns null for an unknown slug, alias, or id", () => {
    const catalog = [makeCindy()]
    expect(resolveBenchmark(catalog, { slug: "not-a-wod" })).toBeNull()
    expect(resolveBenchmark(catalog, { label: "HIIT 20" })).toBeNull()
    expect(resolveBenchmark(catalog, { id: "00000000-0000-4000-8000-000000000000" })).toBeNull()
  })
})

describe("collectReferencedBenchmarkExerciseIds", () => {
  it("returns catalog Rx ids for a slug or Holland label, and nothing for a generic Circuit", () => {
    const catalog = [makeCindy()]
    expect(
      collectReferencedBenchmarkExerciseIds(
        [{ type: "circuit", benchmark_slug: "cindy" }],
        catalog,
      ),
    ).toEqual(["ex-pull", "ex-push", "ex-squat"])
    expect(
      collectReferencedBenchmarkExerciseIds(
        [{ type: "circuit", label: "Holland", exercises: [] }],
        catalog,
      ),
    ).toEqual(["ex-pull", "ex-push", "ex-squat"])
    expect(
      collectReferencedBenchmarkExerciseIds(
        [{ type: "circuit", label: "HIIT 20", exercises: [] }],
        catalog,
      ),
    ).toEqual([])
  })
})
