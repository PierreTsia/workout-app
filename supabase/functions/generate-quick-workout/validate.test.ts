import { describe, it, expect } from "vitest"
import { validateAndRepair } from "./validate"
import type { CatalogEntry } from "./validate"
import { parseExerciseInput } from "../mcp/lib/createProgramValidation"

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
  it("T170: keeps a valid Circuit as one day-item and validates nested catalog IDs", () => {
    const result = validateAndRepair(
      [
        "pec-1",
        {
          type: "circuit",
          label: "Finisher",
          rounds: 3,
          exercises: [
            { exercise_id: "dos-1", amount: 10, weight_kg: 0 },
            { exercise_id: "bic-1", amount: 12, weight_kg: 0 },
          ],
        },
      ],
      CATALOG,
      2,
    )
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toBe("pec-1")
    expect(result.items[1]).toMatchObject({
      type: "circuit",
      label: "Finisher",
      rounds: 3,
    })
    expect(result.exerciseIds).toEqual(["pec-1", "dos-1", "bic-1"])
    expect(result.repaired).toBe(false)
  })

  it("T170: allows the same exercise_id twice inside one Circuit", () => {
    const result = validateAndRepair(
      [
        {
          type: "circuit",
          exercises: [
            { exercise_id: "pec-1", amount: 10, weight_kg: 0 },
            { exercise_id: "pec-1", amount: 8, weight_kg: 0 },
          ],
        },
      ],
      CATALOG,
      1,
    )
    expect(result.items).toHaveLength(1)
    const circuit = result.items[0]
    expect(typeof circuit).not.toBe("string")
    if (typeof circuit === "string") return
    expect(circuit.exercises.map((e) => e.exercise_id)).toEqual(["pec-1", "pec-1"])
  })

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

  it("T189: keeps Cindy as mode=amrap, cap_minutes=20, flat nested, no rounds", () => {
    const result = validateAndRepair(
      [
        {
          type: "circuit",
          label: "Cindy",
          mode: "amrap",
          cap_minutes: 20,
          exercises: [
            { exercise_id: "pec-1", amount: 5, weight_kg: 0 },
            { exercise_id: "dos-1", amount: 10, weight_kg: 0 },
          ],
        },
      ],
      CATALOG,
      1,
    )
    expect(result.items).toHaveLength(1)
    const circuit = result.items[0]
    expect(typeof circuit).not.toBe("string")
    if (typeof circuit === "string") return
    expect(circuit).toMatchObject({
      type: "circuit",
      label: "Cindy",
      mode: "amrap",
      cap_minutes: 20,
    })
    expect(circuit).not.toHaveProperty("rounds")
    expect(result.repaired).toBe(false)
  })

  it("T189: drops mode=amrap when rest_seconds or nested per_round leak", () => {
    const result = validateAndRepair(
      [
        {
          type: "circuit",
          mode: "amrap",
          cap_minutes: 20,
          rest_seconds: 90,
          exercises: [
            { exercise_id: "pec-1", amount: 5, weight_kg: 0 },
            {
              exercise_id: "dos-1",
              per_round: [{ amount: 10, weight_kg: 0 }],
            },
          ],
        },
      ],
      CATALOG,
      1,
    )
    expect(result.items.filter((i) => typeof i !== "string")).toHaveLength(0)
    expect(result.dropped).toBeGreaterThanOrEqual(1)
  })

  it("T189: keeps 4-rounds-in-20-min as Tours (mode omitted)", () => {
    const result = validateAndRepair(
      [
        {
          type: "circuit",
          label: "4 rounds in 20 min",
          rounds: 4,
          rest_seconds: 30,
          exercises: [
            { exercise_id: "pec-1", amount: 10, weight_kg: 0 },
            { exercise_id: "dos-1", amount: 10, weight_kg: 0 },
          ],
        },
      ],
      CATALOG,
      1,
    )
    const circuit = result.items[0]
    expect(typeof circuit).not.toBe("string")
    if (typeof circuit === "string") return
    expect(circuit).toMatchObject({ type: "circuit", rounds: 4, rest_seconds: 30 })
    expect(circuit).not.toHaveProperty("mode")
  })

  it("T192: keeps a slug-only Cindy item without requiring nested exercises", () => {
    const result = validateAndRepair(
      [{ type: "circuit", benchmark_slug: "cindy" }],
      CATALOG,
      1,
    )
    expect(result.items).toEqual([{ type: "circuit", benchmark_slug: "cindy" }])
    expect(result.exerciseIds).toEqual([])
    expect(result.repaired).toBe(false)
  })

  it("T189: validated QW AMRAP payload passes MCP parseExerciseInput", () => {
    const pull = "11111111-2222-4333-8444-555555555555"
    const squat = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    const result = validateAndRepair(
      [
        {
          type: "circuit",
          label: "Holland",
          mode: "amrap",
          cap_minutes: 20,
          exercises: [
            { exercise_id: pull, amount: 5, weight_kg: 0 },
            { exercise_id: squat, amount: 10, weight_kg: 0 },
          ],
        },
      ],
      [
        { id: pull, muscle_group: "Dos" },
        { id: squat, muscle_group: "Quadriceps" },
      ],
      1,
    )
    const parsed = parseExerciseInput(result.items[0], "Holland", 0)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.value).toMatchObject({
      kind: "circuit",
      mode: "amrap",
      capMinutes: 20,
    })
  })
})
