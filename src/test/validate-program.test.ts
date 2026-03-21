import { describe, it, expect } from "vitest"
import { validateProgram } from "../../supabase/functions/generate-program/validate"
import type { GenerateProgramResponse } from "../../supabase/functions/generate-program/types"

const catalog = [
  { id: "c1", muscle_group: "chest" },
  { id: "c2", muscle_group: "chest" },
  { id: "c3", muscle_group: "chest" },
  { id: "b1", muscle_group: "back" },
  { id: "b2", muscle_group: "back" },
  { id: "b3", muscle_group: "back" },
  { id: "l1", muscle_group: "legs" },
  { id: "l2", muscle_group: "legs" },
  { id: "l3", muscle_group: "legs" },
  { id: "l4", muscle_group: "legs" },
  { id: "a1", muscle_group: "arms" },
  { id: "a2", muscle_group: "arms" },
]

const bounds = { min: 3, max: 5 }

function makeLLMOutput(days: { label: string; muscle_focus: string; exercise_ids: string[] }[]): GenerateProgramResponse {
  return { rationale: "Test rationale", days }
}

describe("validateProgram", () => {
  it("passes through a clean response untouched", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1", "c2", "c3"] },
        { label: "Day 2", muscle_focus: "back", exercise_ids: ["b1", "b2", "b3"] },
      ]),
      catalog,
      2,
      bounds,
    )

    expect(result.repaired).toBe(false)
    expect(result.totalDropped).toBe(0)
    expect(result.totalBackfilled).toBe(0)
    expect(result.days).toHaveLength(2)
    expect(result.days[0].exercise_ids).toEqual(["c1", "c2", "c3"])
    expect(result.days[1].exercise_ids).toEqual(["b1", "b2", "b3"])
    expect(result.rationale).toBe("Test rationale")
  })

  it("drops exercise IDs not in catalog", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1", "FAKE_ID", "c2", "c3"] },
      ]),
      catalog,
      1,
      bounds,
    )

    expect(result.days[0].exercise_ids).toEqual(["c1", "c2", "c3"])
    expect(result.days[0].dropped).toBe(1)
    expect(result.repaired).toBe(true)
  })

  it("deduplicates exercises across days", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1", "c2", "c3"] },
        { label: "Day 2", muscle_focus: "back", exercise_ids: ["c1", "b1", "b2"] },
      ]),
      catalog,
      2,
      bounds,
    )

    expect(result.days[0].exercise_ids).toContain("c1")
    expect(result.days[1].exercise_ids).not.toContain("c1")
    expect(result.days[1].dropped).toBe(1)
  })

  it("backfills when day has fewer exercises than minimum", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1"] },
      ]),
      catalog,
      1,
      bounds,
    )

    expect(result.days[0].exercise_ids.length).toBeGreaterThanOrEqual(bounds.min)
    expect(result.days[0].exercise_ids[0]).toBe("c1")
    expect(result.days[0].backfilled).toBeGreaterThan(0)
    expect(result.repaired).toBe(true)
  })

  it("backfills from preferred muscle focus first", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1"] },
      ]),
      catalog,
      1,
      bounds,
    )

    const backfilled = result.days[0].exercise_ids.slice(1)
    const chestIds = backfilled.filter((id) => id.startsWith("c"))
    expect(chestIds.length).toBeGreaterThan(0)
  })

  it("trims excess exercises beyond max", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "mixed", exercise_ids: ["c1", "c2", "c3", "b1", "b2", "b3", "l1"] },
      ]),
      catalog,
      1,
      { min: 3, max: 4 },
    )

    expect(result.days[0].exercise_ids).toHaveLength(4)
  })

  it("truncates days beyond targetDayCount", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1", "c2", "c3"] },
        { label: "Day 2", muscle_focus: "back", exercise_ids: ["b1", "b2", "b3"] },
        { label: "Day 3", muscle_focus: "legs", exercise_ids: ["l1", "l2", "l3"] },
      ]),
      catalog,
      2,
      bounds,
    )

    expect(result.days).toHaveLength(2)
  })

  it("returns empty days array for empty LLM output", () => {
    const result = validateProgram(
      makeLLMOutput([]),
      catalog,
      3,
      bounds,
    )

    expect(result.days).toHaveLength(0)
    expect(result.repaired).toBe(false)
  })

  it("deduplicates within the same day", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1", "c1", "c2", "c3"] },
      ]),
      catalog,
      1,
      bounds,
    )

    expect(result.days[0].exercise_ids).toEqual(["c1", "c2", "c3"])
    expect(result.days[0].dropped).toBe(1)
  })

  it("handles all invalid IDs with backfill", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["FAKE1", "FAKE2", "FAKE3"] },
      ]),
      catalog,
      1,
      bounds,
    )

    expect(result.days[0].dropped).toBe(3)
    expect(result.days[0].exercise_ids.length).toBeGreaterThanOrEqual(bounds.min)
    expect(result.days[0].backfilled).toBeGreaterThanOrEqual(bounds.min)
  })

  it("assigns default label when missing", () => {
    const result = validateProgram(
      { rationale: "ok", days: [{ label: "", muscle_focus: "chest", exercise_ids: ["c1", "c2", "c3"] }] },
      catalog,
      1,
      bounds,
    )

    expect(result.days[0].label).toBe("")
  })
})
