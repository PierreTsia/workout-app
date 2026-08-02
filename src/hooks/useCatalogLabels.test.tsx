import { describe, it, expect } from "vitest"

import { renderHookWithProviders } from "@/test/utils"
import { useCatalogLabels } from "./useCatalogLabels"

const BENCH = {
  exercise: { name: "Développé couché", name_en: "Bench Press" },
  name_snapshot: "Développé couché",
}

function labels(locale: "en" | "fr") {
  return renderHookWithProviders(() => useCatalogLabels(), { locale }).result
    .current
}

describe("useCatalogLabels", () => {
  it("resolves the same row to two different names across locales", () => {
    expect(labels("en").exerciseName(BENCH)).toBe("Bench Press")
    expect(labels("fr").exerciseName(BENCH)).toBe("Développé couché")
  })

  it("translates a canonical muscle name for an English reader", () => {
    expect(labels("en").muscleLabel("Ischios")).toBe("Hamstrings")
  })

  it("leaves a canonical muscle name untouched for a French reader", () => {
    expect(labels("fr").muscleLabel("Ischios")).toBe("Ischios")
  })

  it("renders an out-of-taxonomy snapshot value raw rather than as a key", () => {
    const muscleLabel = labels("en").muscleLabel

    expect(muscleLabel("Deltoïdes post.")).toBe("Deltoïdes post.")
    expect(muscleLabel("Ischios / Bas du dos")).toBe("Ischios / Bas du dos")
  })

  it("translates equipment slugs and passes unknown ones through", () => {
    expect(labels("en").equipmentLabel("ez_bar")).toBe("EZ Bar")
    expect(labels("fr").equipmentLabel("ez_bar")).toBe("Barre EZ")
    expect(labels("en").equipmentLabel("smith_machine")).toBe("smith_machine")
  })

  it("resolves the same row to two different instruction blocks across locales", () => {
    const row = {
      instructions: {
        setup: ["Allonge-toi sur le banc"],
        movement: [],
        breathing: [],
        common_mistakes: [],
      },
      instructions_en: {
        setup: ["Lie back on the bench"],
        movement: [],
        breathing: [],
        common_mistakes: [],
      },
      instructions_en_status: "clean",
    }

    expect(labels("en").exerciseInstructions(row)?.setup).toEqual([
      "Lie back on the bench",
    ])
    expect(labels("fr").exerciseInstructions(row)?.setup).toEqual([
      "Allonge-toi sur le banc",
    ])
  })

  it("never returns null for a missing value", () => {
    const { muscleLabel, equipmentLabel } = labels("en")

    expect(muscleLabel(null)).toBe("")
    expect(equipmentLabel(undefined)).toBe("")
  })
})
