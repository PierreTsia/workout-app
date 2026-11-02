import { describe, expect, it } from "vitest"

import { buildDayRenderedLines } from "./daySequence"
import type { CatalogExerciseForProgram } from "./programPersistence"

const ID_BENCH = "cccccccc-3333-4333-8333-333333333333"

const catalog = new Map<string, CatalogExerciseForProgram>([
  [
    ID_BENCH,
    {
      id: ID_BENCH,
      name: "Développé couché",
      name_en: "Bench Press",
      muscle_group: "Pectoraux",
      emoji: "💪",
      equipment: "barbell",
      measurement_type: "reps",
      default_duration_seconds: null,
    },
  ],
])

describe("buildDayRenderedLines locale (T712)", () => {
  const items = [{ kind: "bare" as const, exerciseId: ID_BENCH }]

  it("renders the English catalog name for an English reader", () => {
    const out = buildDayRenderedLines(items, catalog, "en").join("\n")
    expect(out).toContain("Bench Press")
    expect(out).not.toContain("Développé couché")
  })

  it("renders the French catalog name for a French reader", () => {
    const out = buildDayRenderedLines(items, catalog, "fr").join("\n")
    expect(out).toContain("Développé couché")
    expect(out).not.toContain("Bench Press")
  })
})
