import { describe, expect, it } from "vitest"
import { formatCircuitPreviewLines } from "./format"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type { ParsedExercise } from "./createProgramValidation"

const ID_A = "11111111-2222-4333-8444-555555555555"
const ID_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

const catalog = new Map<string, CatalogExerciseForProgram>([
  [
    ID_A,
    {
      id: ID_A,
      name: "Burpee",
      muscle_group: "Full Body",
      emoji: null,
      equipment: "bodyweight",
      measurement_type: "reps",
      default_duration_seconds: null,
    },
  ],
  [
    ID_B,
    {
      id: ID_B,
      name: "Swing",
      muscle_group: "Posterior Chain",
      emoji: null,
      equipment: "kettlebell",
      measurement_type: "reps",
      default_duration_seconds: null,
    },
  ],
])

describe("formatCircuitPreviewLines (T163)", () => {
  it("renders a compact preview when all rounds are flat/homogeneous", () => {
    const circuit: Extract<ParsedExercise, { kind: "circuit" }> = {
      kind: "circuit",
      label: "Finisher",
      rounds: 3,
      restSeconds: 90,
      transitionSeconds: 0,
      exercises: [
        { mode: "flat", exerciseId: ID_A, amount: 10, weightKg: 0 },
        { mode: "flat", exerciseId: ID_B, amount: 12, weightKg: 16 },
      ],
    }
    const lines = formatCircuitPreviewLines(circuit, catalog)
    expect(lines[0]).toContain('Circuit "Finisher"')
    expect(lines[0].startsWith("Circuit \"Finisher\"")).toBe(true)
    expect(lines[0]).toContain("3 rounds")
    expect(lines).toContain("  Burpee — 10 @ 0 kg")
    expect(lines).toContain("  Swing — 12 @ 16 kg")
    expect(lines.some((l) => l.includes("Round 1"))).toBe(false)
  })

  it("expands round-by-round when per_round amounts differ", () => {
    const circuit: Extract<ParsedExercise, { kind: "circuit" }> = {
      kind: "circuit",
      label: null,
      rounds: 3,
      restSeconds: 60,
      transitionSeconds: 15,
      exercises: [
        {
          mode: "per_round",
          exerciseId: ID_A,
          perRound: [
            { amount: 20, weightKg: 0 },
            { amount: 15, weightKg: 0 },
            { amount: 10, weightKg: 0 },
          ],
        },
        { mode: "flat", exerciseId: ID_B, amount: 12, weightKg: 0 },
      ],
    }
    const lines = formatCircuitPreviewLines(circuit, catalog)
    expect(lines[0].startsWith("Circuit —")).toBe(true)
    expect(lines[1]).toContain("Round 1:")
    expect(lines[1]).toContain("Burpee 20@0 kg")
    expect(lines[3]).toContain("Round 3:")
    expect(lines[3]).toContain("Burpee 10@0 kg")
  })

  it("renders AMRAP as 'AMRAP 20 min' plus gloss, never a naked AMRAP", () => {
    const circuit: Extract<ParsedExercise, { kind: "circuit" }> = {
      kind: "circuit",
      label: "Cindy",
      mode: "amrap",
      capMinutes: 20,
      rounds: 1,
      restSeconds: 0,
      transitionSeconds: 0,
      exercises: [
        { mode: "flat", exerciseId: ID_A, amount: 5, weightKg: 0 },
        { mode: "flat", exerciseId: ID_B, amount: 10, weightKg: 0 },
      ],
    }
    const lines = formatCircuitPreviewLines(circuit, catalog)
    const rendered = lines.join("\n")

    expect(lines[0]).toContain("AMRAP 20 min")
    expect(rendered).toContain("As many rounds as possible.")
    expect(rendered).not.toMatch(/AMRAP(?! \d+ min)/)
    expect(lines[0]).not.toContain("rounds")
    expect(lines).toContain("  Burpee — 5 @ 0 kg")
    expect(lines).toContain("  Swing — 10 @ 0 kg")
  })
})
