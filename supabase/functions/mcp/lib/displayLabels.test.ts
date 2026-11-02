import { describe, expect, it } from "vitest"

import { muscleLabel, resolveDisplayName, warningText } from "./displayLabels"
describe("resolveDisplayName", () => {
  it("prefers name_en for an English reader", () => {
    expect(
      resolveDisplayName({ name: "Développé couché", name_en: "Bench Press" }, "en"),
    ).toBe("Bench Press")
  })

  it("uses the French name for a French reader", () => {
    expect(
      resolveDisplayName({ name: "Développé couché", name_en: "Bench Press" }, "fr"),
    ).toBe("Développé couché")
  })

  it("falls back to the snapshot when the catalog row is absent", () => {
    expect(resolveDisplayName({ name_snapshot: "Développé couché" }, "en")).toBe(
      "Développé couché",
    )
  })

  it("falls back to French name when an English reader has no name_en", () => {
    expect(resolveDisplayName({ name: "Planche" }, "en")).toBe("Planche")
  })

  it("treats a blank name_en as absent", () => {
    expect(resolveDisplayName({ name: "Planche", name_en: "  " }, "en")).toBe("Planche")
  })

  it("returns an empty string when nothing is available", () => {
    expect(resolveDisplayName({}, "en")).toBe("")
  })
})

describe("muscleLabel", () => {
  it("maps a canonical French muscle to English for an English reader", () => {
    expect(muscleLabel("Épaules", "en")).toBe("Shoulders")
    expect(muscleLabel("Pectoraux", "en")).toBe("Chest")
  })

  it("keeps the French label for a French reader", () => {
    expect(muscleLabel("Épaules", "fr")).toBe("Épaules")
  })

  it("passes through an off-taxonomy value", () => {
    expect(muscleLabel("Deltoïdes post.", "en")).toBe("Deltoïdes post.")
  })

  it("handles null and empty", () => {
    expect(muscleLabel(null, "en")).toBe("")
    expect(muscleLabel("", "en")).toBe("")
  })
})

describe("warningText", () => {
  it("renders the active-cycle warning in English", () => {
    expect(warningText("active_cycle", "en", { date: "2026-10-01" })).toContain(
      "Active cycle since 2026-10-01",
    )
  })

  it("keeps the exact French active-cycle wording", () => {
    expect(warningText("active_cycle", "fr", { date: "2026-10-01" })).toBe(
      "Cycle actif depuis 2026-10-01 — cette modification affecte vos workouts restants dans ce cycle.",
    )
  })

  it("renders the slot-detachment warning in both locales", () => {
    expect(warningText("slot_detachment", "en", { exercise: "Bench Press" })).toContain(
      "Bench Press",
    )
    expect(warningText("slot_detachment", "fr", { exercise: "Développé couché" })).toBe(
      "Historique détaché : « Développé couché » est retiré ou remplacé — sa progression repart de la prescription du template.",
    )
  })
})
