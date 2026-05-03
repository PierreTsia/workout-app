import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { formatPrescriptionLine, formatWeightConvention, type WeightConvention } from "./format.ts"

const KNOWN_EQUIPMENT: Array<[string, WeightConvention]> = [
  ["dumbbell", "per_hand"],
  ["kettlebell", "per_hand"],
  ["barbell", "total"],
  ["machine", "total"],
  ["cable", "total"],
  ["bodyweight", "bodyweight"],
  ["band", "total"],
  ["other", "total"],
]

for (const [equipment, expected] of KNOWN_EQUIPMENT) {
  Deno.test(`formatWeightConvention maps known equipment "${equipment}" to "${expected}" without warning`, () => {
    const warnings: unknown[][] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args)
    }
    try {
      const convention = formatWeightConvention(equipment)
      assertEquals(convention, expected)
      assertEquals(warnings.length, 0)
    } finally {
      console.warn = original
    }
  })
}

Deno.test("formatWeightConvention falls back to 'total' AND warns when equipment is unknown", () => {
  const warnings: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args)
  }
  try {
    const convention = formatWeightConvention("flux-capacitor")
    assertEquals(convention, "total")
    assertEquals(warnings.length, 1)
    const [firstArg] = warnings[0]
    assertEquals(typeof firstArg === "string" && firstArg.includes("flux-capacitor"), true)
  } finally {
    console.warn = original
  }
})

Deno.test("formatWeightConvention falls back to 'total' AND warns on the empty string (defensive)", () => {
  const warnings: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args)
  }
  try {
    const convention = formatWeightConvention("")
    assertEquals(convention, "total")
    assertEquals(warnings.length, 1)
  } finally {
    console.warn = original
  }
})

Deno.test("formatPrescriptionLine renders barbell linear with 'X kg total'", () => {
  const line = formatPrescriptionLine({
    exerciseName: "Bench Press",
    sets: 4,
    reps: "8",
    weightKg: 80,
    restSeconds: 120,
    weightConvention: "total",
  })
  assertEquals(line, "Bench Press — 4 × 8 × 80 kg total — 120s rest")
})

Deno.test("formatPrescriptionLine renders dumbbell double-progression with 'X kg per hand'", () => {
  const line = formatPrescriptionLine({
    exerciseName: "DB Curl",
    sets: 4,
    reps: "8-12",
    weightKg: 15,
    restSeconds: 90,
    weightConvention: "per_hand",
  })
  assertEquals(line, "DB Curl — 4 × 8-12 × 15 kg per hand — 90s rest")
})

Deno.test("formatPrescriptionLine renders bodyweight with '(bodyweight)' and no kg suffix", () => {
  const line = formatPrescriptionLine({
    exerciseName: "Pushup",
    sets: 4,
    reps: "12",
    weightKg: 0,
    restSeconds: 90,
    weightConvention: "bodyweight",
  })
  assertEquals(line, "Pushup — 4 × 12 (bodyweight) — 90s rest")
})

Deno.test("formatPrescriptionLine renders fractional weight using one decimal", () => {
  const line = formatPrescriptionLine({
    exerciseName: "DB Curl",
    sets: 3,
    reps: "10",
    weightKg: 22.5,
    restSeconds: 60,
    weightConvention: "per_hand",
  })
  assertEquals(line, "DB Curl — 3 × 10 × 22.5 kg per hand — 60s rest")
})
