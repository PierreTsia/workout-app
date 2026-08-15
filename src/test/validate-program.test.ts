import { describe, it, expect } from "vitest"
import {
  validateProgram,
  type GenerateProgramResponse,
} from "../../supabase/functions/_shared/programDraft"
import { parseExerciseInput } from "../../supabase/functions/mcp/lib/createProgramValidation"

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

  it("returns trimmed exercises to the pool for later days", () => {
    const result = validateProgram(
      makeLLMOutput([
        { label: "Day 1", muscle_focus: "chest", exercise_ids: ["c1", "c2", "c3", "b1", "b2", "b3", "l1"] },
        { label: "Day 2", muscle_focus: "back", exercise_ids: ["l2"] },
      ]),
      catalog,
      2,
      { min: 3, max: 4 },
    )

    expect(result.days[0].exercise_ids).toHaveLength(4)
    const trimmedFromDay1 = ["b2", "b3", "l1"]
    const day2Ids = result.days[1].exercise_ids
    const reusedFromTrim = day2Ids.filter((id) => trimmedFromDay1.includes(id))
    expect(reusedFromTrim.length).toBeGreaterThan(0)
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

  it("T168: keeps the same exercise_id twice inside one Circuit (complex)", () => {
    const result = validateProgram(
      {
        rationale: "complex",
        days: [
          {
            label: "Cond",
            muscle_focus: "chest",
            exercises: [
              "c1",
              {
                type: "circuit",
                label: "Complex",
                rounds: 3,
                exercises: [
                  { exercise_id: "c2", amount: 10, weight_kg: 0 },
                  { exercise_id: "c2", amount: 8, weight_kg: 0 },
                ],
              },
            ],
          },
        ],
      },
      catalog,
      1,
      { min: 2, max: 5 },
    )

    const circuit = result.days[0].exercises.find(
      (i) => typeof i !== "string" && i.type === "circuit",
    )
    expect(circuit).toBeDefined()
    if (typeof circuit === "string" || !circuit) throw new Error("expected circuit")
    expect(circuit.exercises.map((e) => e.exercise_id)).toEqual(["c2", "c2"])
    expect(result.days[0].exercises).toHaveLength(2)
  })

  it("T168: counts a Circuit as one slot toward the day max", () => {
    const result = validateProgram(
      {
        rationale: "slots",
        days: [
          {
            label: "Day 1",
            muscle_focus: "chest",
            exercises: [
              "c1",
              "c2",
              "c3",
              {
                type: "circuit",
                rounds: 3,
                exercises: [
                  { exercise_id: "a1", amount: 10, weight_kg: 0 },
                  { exercise_id: "a2", amount: 10, weight_kg: 0 },
                ],
              },
              "b1",
            ],
          },
        ],
      },
      catalog,
      1,
      { min: 2, max: 4 },
    )

    // 3 solos + 1 Circuit = 4 slots; trailing solo trimmed
    expect(result.days[0].exercises).toHaveLength(4)
    expect(
      result.days[0].exercises.filter((i) => typeof i !== "string").length,
    ).toBe(1)
  })

  it("T189: keeps Cindy as mode=amrap, cap_minutes=20, flat nested, no rounds", () => {
    const result = validateProgram(
      {
        rationale: "Cindy",
        days: [
          {
            label: "Cond",
            muscle_focus: "chest",
            exercises: [
              {
                type: "circuit",
                label: "Cindy",
                mode: "amrap",
                cap_minutes: 20,
                exercises: [
                  { exercise_id: "c1", amount: 5, weight_kg: 0 },
                  { exercise_id: "c2", amount: 10, weight_kg: 0 },
                ],
              },
            ],
          },
        ],
      },
      catalog,
      1,
      { min: 1, max: 5 },
    )

    const circuit = result.days[0].exercises[0]
    expect(typeof circuit).not.toBe("string")
    if (typeof circuit === "string") throw new Error("expected circuit")
    expect(circuit).toMatchObject({
      type: "circuit",
      label: "Cindy",
      mode: "amrap",
      cap_minutes: 20,
    })
    expect(circuit).not.toHaveProperty("rounds")
    expect(circuit.exercises).toEqual([
      { exercise_id: "c1", amount: 5, weight_kg: 0 },
      { exercise_id: "c2", amount: 10, weight_kg: 0 },
    ])
  })

  it("T189: drops mode=amrap when rounds, rest, or nested per_round leak", () => {
    const result = validateProgram(
      {
        rationale: "leaky",
        days: [
          {
            label: "Cond",
            muscle_focus: "chest",
            exercises: [
              {
                type: "circuit",
                mode: "amrap",
                cap_minutes: 20,
                rounds: 3,
                rest_seconds: 90,
                exercises: [
                  { exercise_id: "c1", amount: 5, weight_kg: 0 },
                  {
                    exercise_id: "c2",
                    per_round: [{ amount: 10, weight_kg: 0 }],
                  },
                ],
              },
              "c3",
            ],
          },
        ],
      },
      catalog,
      1,
      { min: 1, max: 5 },
    )

    expect(
      result.days[0].exercises.filter((i) => typeof i !== "string"),
    ).toHaveLength(0)
    expect(result.days[0].dropped).toBeGreaterThanOrEqual(1)
  })

  it("T189: keeps HIIT / explicit-round Circuits as Tours (mode omitted, rounds kept)", () => {
    const result = validateProgram(
      {
        rationale: "HIIT 20 min",
        days: [
          {
            label: "Cond",
            muscle_focus: "chest",
            exercises: [
              {
                type: "circuit",
                label: "HIIT 20 min",
                rounds: 4,
                rest_seconds: 30,
                exercises: [
                  { exercise_id: "c1", amount: 10, weight_kg: 0 },
                  { exercise_id: "c2", amount: 10, weight_kg: 0 },
                ],
              },
            ],
          },
        ],
      },
      catalog,
      1,
      { min: 1, max: 5 },
    )

    const circuit = result.days[0].exercises[0]
    expect(typeof circuit).not.toBe("string")
    if (typeof circuit === "string") throw new Error("expected circuit")
    expect(circuit).toMatchObject({
      type: "circuit",
      label: "HIIT 20 min",
      rounds: 4,
      rest_seconds: 30,
    })
    expect(circuit).not.toHaveProperty("mode")
    expect(circuit).not.toHaveProperty("cap_minutes")
  })

  it("T189: strips cap_minutes from a Tours Circuit (mode omitted)", () => {
    const result = validateProgram(
      {
        rationale: "HIIT",
        days: [
          {
            label: "Cond",
            muscle_focus: "chest",
            exercises: [
              {
                type: "circuit",
                label: "HIIT 20 min",
                cap_minutes: 20,
                rounds: 4,
                exercises: [
                  { exercise_id: "c1", amount: 10, weight_kg: 0 },
                  { exercise_id: "c2", amount: 10, weight_kg: 0 },
                ],
              },
            ],
          },
        ],
      },
      catalog,
      1,
      { min: 1, max: 5 },
    )

    const circuit = result.days[0].exercises[0]
    expect(typeof circuit).not.toBe("string")
    if (typeof circuit === "string") throw new Error("expected circuit")
    expect(circuit).toMatchObject({ type: "circuit", rounds: 4 })
    expect(circuit).not.toHaveProperty("cap_minutes")
    expect(circuit).not.toHaveProperty("mode")
  })

  it("T189: drops mode=amrap when cap_minutes is outside 1–60", () => {
    const result = validateProgram(
      {
        rationale: "bad cap",
        days: [
          {
            label: "Cond",
            muscle_focus: "chest",
            exercises: [
              {
                type: "circuit",
                mode: "amrap",
                cap_minutes: 90,
                exercises: [
                  { exercise_id: "c1", amount: 5, weight_kg: 0 },
                  { exercise_id: "c2", amount: 10, weight_kg: 0 },
                ],
              },
            ],
          },
        ],
      },
      catalog,
      1,
      { min: 1, max: 5 },
    )

    expect(
      result.days[0].exercises.filter((i) => typeof i !== "string"),
    ).toHaveLength(0)
  })

  it("T189: validated Cindy payload passes MCP parseExerciseInput (T187)", () => {
    const pull = "11111111-2222-4333-8444-555555555555"
    const squat = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    const uuidCatalog = [
      { id: pull, muscle_group: "back" },
      { id: squat, muscle_group: "legs" },
    ]
    const result = validateProgram(
      {
        rationale: "Cindy",
        days: [
          {
            label: "Cindy Day",
            muscle_focus: "back",
            exercises: [
              {
                type: "circuit",
                label: "Cindy",
                mode: "amrap",
                cap_minutes: 20,
                exercises: [
                  { exercise_id: pull, amount: 5, weight_kg: 0 },
                  { exercise_id: squat, amount: 10, weight_kg: 0 },
                ],
              },
            ],
          },
        ],
      },
      uuidCatalog,
      1,
      { min: 1, max: 5 },
    )

    const circuit = result.days[0].exercises[0]
    expect(typeof circuit).not.toBe("string")
    const parsed = parseExerciseInput(circuit, "Cindy Day", 0)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.value).toMatchObject({
      kind: "circuit",
      mode: "amrap",
      capMinutes: 20,
    })
  })
})
