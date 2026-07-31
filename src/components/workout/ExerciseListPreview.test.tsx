import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { ExercisePreviewItem } from "@/lib/sessionSummary"
import { ExerciseListPreview } from "./ExerciseListPreview"

const item = (
  overrides: Partial<ExercisePreviewItem> = {},
): ExercisePreviewItem => ({
  id: "we-1",
  emoji: "🏋️",
  exercise: { name: "Développé couché", name_en: "Bench Press" },
  name_snapshot: "Développé couché",
  sets: 3,
  reps: "10",
  maxWeight: 80,
  ...overrides,
})

function render(items: ExercisePreviewItem[], locale: "en" | "fr" = "en") {
  return renderWithProviders(<ExerciseListPreview items={items} />, { locale })
}

describe("ExerciseListPreview", () => {
  it.each([
    ["en", "Bench Press"],
    ["fr", "Développé couché"],
  ] as const)("names the recapped exercise in %s", (locale, name) => {
    render([item()], locale)

    expect(screen.getByText(name)).toBeInTheDocument()
  })

  // The recap sits under a session screen that already reads English; a French
  // name here was the last visible seam (#431).
  it("does not leak the French name to an English reader", () => {
    render([item()])

    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  it("falls back to the frozen snapshot when the catalog row is gone", () => {
    render([item({ exercise: null, name_snapshot: "Exercice supprimé" })])

    expect(screen.getByText("Exercice supprimé")).toBeInTheDocument()
  })

  // An exercise the catalog never translated: the French name is all there is,
  // and showing it beats showing nothing.
  it("falls back to the French name when name_en is null", () => {
    render([item({ exercise: { name: "Gainage latéral", name_en: null } })])

    expect(screen.getByText("Gainage latéral")).toBeInTheDocument()
  })

  it("renders nothing for an empty recap", () => {
    const { container } = render([])

    expect(container).toBeEmptyDOMElement()
  })

  it("keeps showing the set and rep line next to the name", () => {
    render([item({ sets: 4, reps: "8–10" })])

    expect(screen.getByText(/4 × 8–10/)).toBeInTheDocument()
  })
})
