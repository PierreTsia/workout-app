import { describe, it, expect } from "vitest"
import { validateAndRepair } from "./validate"
import type { CatalogEntry } from "./validate"

function makeCatalog(
  entries: Array<{ id: string; muscle_group: string }>,
): CatalogEntry[] {
  return entries
}

const CATALOG: CatalogEntry[] = makeCatalog([
  { id: "pec-1", muscle_group: "Pectoraux" },
  { id: "pec-2", muscle_group: "Pectoraux" },
  { id: "pec-3", muscle_group: "Pectoraux" },
  { id: "dos-1", muscle_group: "Dos" },
  { id: "dos-2", muscle_group: "Dos" },
  { id: "dos-3", muscle_group: "Dos" },
  { id: "bic-1", muscle_group: "Biceps" },
  { id: "bic-2", muscle_group: "Biceps" },
  { id: "tri-1", muscle_group: "Triceps" },
  { id: "tri-2", muscle_group: "Triceps" },
])

describe("validateAndRepair", () => {
  it("returns all valid IDs unchanged when count matches target", () => {
    const result = validateAndRepair(
      ["pec-1", "dos-1", "bic-1", "tri-1", "pec-2"],
      CATALOG,
      5,
    )
    expect(result.exerciseIds).toEqual(["pec-1", "dos-1", "bic-1", "tri-1", "pec-2"])
    expect(result.repaired).toBe(false)
    expect(result.dropped).toBe(0)
    expect(result.backfilled).toBe(0)
  })

  it("drops invalid IDs and backfills to reach target", () => {
    const result = validateAndRepair(
      ["pec-1", "FAKE-1", "dos-1", "FAKE-2", "bic-1"],
      CATALOG,
      5,
    )
    expect(result.exerciseIds).toHaveLength(5)
    expect(result.exerciseIds.slice(0, 3)).toEqual(["pec-1", "dos-1", "bic-1"])
    expect(result.repaired).toBe(true)
    expect(result.dropped).toBe(2)
    expect(result.backfilled).toBe(2)
    for (const id of result.exerciseIds) {
      expect(CATALOG.some((e) => e.id === id)).toBe(true)
    }
  })

  it("deduplicates IDs and backfills the gap", () => {
    const result = validateAndRepair(
      ["pec-1", "pec-1", "dos-1", "bic-1", "tri-1"],
      CATALOG,
      5,
    )
    expect(result.exerciseIds).toHaveLength(5)
    const unique = new Set(result.exerciseIds)
    expect(unique.size).toBe(5)
    expect(result.repaired).toBe(true)
  })

  it("returns empty array when all IDs are hallucinated", () => {
    const result = validateAndRepair(
      ["FAKE-1", "FAKE-2", "FAKE-3", "FAKE-4", "FAKE-5"],
      CATALOG,
      5,
    )
    expect(result.exerciseIds).toHaveLength(5)
    expect(result.dropped).toBe(5)
    expect(result.backfilled).toBe(5)
    expect(result.repaired).toBe(true)
  })

  it("backfills from other groups when target group is exhausted", () => {
    const smallCatalog = makeCatalog([
      { id: "pec-1", muscle_group: "Pectoraux" },
      { id: "pec-2", muscle_group: "Pectoraux" },
      { id: "dos-1", muscle_group: "Dos" },
      { id: "dos-2", muscle_group: "Dos" },
      { id: "bic-1", muscle_group: "Biceps" },
    ])

    const result = validateAndRepair(
      ["pec-1", "FAKE-1", "FAKE-2", "FAKE-3", "FAKE-4"],
      smallCatalog,
      5,
    )
    expect(result.exerciseIds).toHaveLength(5)
    expect(result.exerciseIds).toContain("pec-1")
    expect(result.backfilled).toBe(4)
  })

  it("trims to target when more valid IDs than needed", () => {
    const result = validateAndRepair(
      ["pec-1", "dos-1", "bic-1", "tri-1", "pec-2", "dos-2", "bic-2"],
      CATALOG,
      5,
    )
    expect(result.exerciseIds).toHaveLength(5)
    expect(result.dropped).toBe(0)
    expect(result.backfilled).toBe(0)
  })
})
