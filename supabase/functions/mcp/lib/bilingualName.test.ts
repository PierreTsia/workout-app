import { describe, expect, it } from "vitest"
import {
  bilingualExerciseLabel,
  formatBilingualExerciseName,
  unwrapCatalogNameEmbed,
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

describe("unwrapCatalogNameEmbed", () => {
  const row = { name: "Planche", name_en: "Plank" }

  it("passes through a single embed object", () => {
    expect(unwrapCatalogNameEmbed(row)).toEqual(row)
  })

  it("takes the first row when the client typed the embed as an array", () => {
    expect(unwrapCatalogNameEmbed([row])).toEqual(row)
  })

  it("returns null for missing embeds", () => {
    expect(unwrapCatalogNameEmbed(null)).toBeNull()
    expect(unwrapCatalogNameEmbed([])).toBeNull()
  })
})
