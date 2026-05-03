import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { formatWeightConvention, type WeightConvention } from "./format.ts"

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
