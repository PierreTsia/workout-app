import { describe, expect, it } from "vitest"
import {
  bilingualExerciseLabel,
  formatBilingualExerciseName,
} from "./bilingualName"

describe("formatBilingualExerciseName", () => {
  it("renders French name with English in parentheses", () => {
    expect(formatBilingualExerciseName("Développé couché", "Bench Press")).toBe(
      "**Développé couché** (Bench Press)",
    )
  })

  it("omits empty parentheses when name_en is missing or blank", () => {
    expect(formatBilingualExerciseName("Planche", null)).toBe("**Planche**")
    expect(formatBilingualExerciseName("Planche", "")).toBe("**Planche**")
    expect(formatBilingualExerciseName("Planche", "   ")).toBe("**Planche**")
  })
})

describe("bilingualExerciseLabel", () => {
  it("matches the bold formatter without markdown markers", () => {
    expect(bilingualExerciseLabel("Développé couché", "Bench Press")).toBe(
      "Développé couché (Bench Press)",
    )
    expect(bilingualExerciseLabel("Planche", null)).toBe("Planche")
  })
})
