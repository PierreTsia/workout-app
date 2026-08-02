import { describe, it, expect } from "vitest"
import { screen, within } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { TranslationReviewCard } from "@/components/admin/translations/TranslationReviewCard"
import type { TranslationReviewRow } from "@/hooks/useTranslationReviewQueue"

const row: TranslationReviewRow = {
  id: "row-1",
  name: "Développé couché",
  name_en: "Bench Press",
  instructions: {
    setup: [
      "Allongez-vous sur le banc.",
      "Écartez les mains à largeur d'épaules.",
    ],
    movement: ["Poussez la barre vers le haut."],
    breathing: ["Expirez à la poussée."],
    common_mistakes: ["Dos creusé."],
  },
  instructions_en: {
    setup: ["Lie back on the bench.", "Set your hands hip-width apart."],
    movement: ["Press the bar upward."],
    breathing: ["Exhale as you press."],
    common_mistakes: ["Arched lower back."],
  },
  instructions_en_status: "flagged",
  instructions_en_audit: {
    model: "gemini-2.5-flash",
    prompt_version: 1,
    translated_at: "2026-08-02T12:26:44.264Z",
    checker_model: "llama-3.3-70b-versatile",
    gate_flags: ["calques: lumbar"],
    objections: [
      {
        section: "setup",
        index: 1,
        verdict: "measurement-changed",
        note: "'largeur des épaules' rendered as 'hip-width'",
      },
    ],
  },
  logged_sets: 152,
}

const lineContaining = (text: string): HTMLElement =>
  screen.getByText(text).closest("li")!

describe("TranslationReviewCard", () => {
  it("shows both names, the status and the reading exposure", () => {
    renderWithProviders(<TranslationReviewCard row={row} />)

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Flagged")).toBeInTheDocument()
    expect(screen.getByText("152 logged sets")).toBeInTheDocument()
  })

  // The acceptance criterion: the objection is attached to the sentence it
  // named. Asserting it lands *somewhere* would pass on a section-level banner,
  // so both the presence and the absence are checked.
  it("renders an objection on the sentence it targeted", () => {
    renderWithProviders(<TranslationReviewCard row={row} />)

    const targeted = lineContaining("Set your hands hip-width apart.")
    expect(
      within(targeted).getByText(/measurement-changed/),
    ).toBeInTheDocument()
    expect(
      within(targeted).getByText(
        "'largeur des épaules' rendered as 'hip-width'",
        { exact: false },
      ),
    ).toBeInTheDocument()
  })

  it("leaves the untargeted sentence in the same section clean", () => {
    renderWithProviders(<TranslationReviewCard row={row} />)

    const untouched = lineContaining("Lie back on the bench.")
    expect(within(untouched).queryByText(/measurement-changed/)).toBeNull()
  })

  it("pairs each English sentence with its French counterpart", () => {
    renderWithProviders(<TranslationReviewCard row={row} />)

    const pair = lineContaining("Set your hands hip-width apart.")
    expect(
      within(pair).getByText("Écartez les mains à largeur d'épaules."),
    ).toBeInTheDocument()
  })

  // A gate flag has no section or index, so it belongs to the row, not to a
  // sentence — and a row can be flagged with no objection at all.
  it("shows gate flags at row level and survives an empty objection list", () => {
    const gateOnly: TranslationReviewRow = {
      ...row,
      instructions_en_audit: { ...row.instructions_en_audit!, objections: [] },
    }
    renderWithProviders(<TranslationReviewCard row={gateOnly} />)

    expect(screen.getByText("calques: lumbar")).toBeInTheDocument()
    expect(screen.queryByText(/measurement-changed/)).toBeNull()
  })

  it("names the missing side when the translation dropped a sentence", () => {
    const truncated: TranslationReviewRow = {
      ...row,
      instructions_en: { ...row.instructions_en!, setup: ["Lie back on the bench."] },
    }
    renderWithProviders(<TranslationReviewCard row={truncated} />)

    const orphaned = lineContaining("Écartez les mains à largeur d'épaules.")
    expect(
      within(orphaned).getByText("no sentence at this position"),
    ).toBeInTheDocument()
  })

  it("says so when the cross-checker never answered", () => {
    const unchecked: TranslationReviewRow = {
      ...row,
      instructions_en_audit: { ...row.instructions_en_audit!, checker_model: null },
    }
    renderWithProviders(<TranslationReviewCard row={unchecked} />)

    expect(screen.getByText(/no cross-checker/)).toBeInTheDocument()
  })

  it("renders every label in French under the fr locale", () => {
    renderWithProviders(<TranslationReviewCard row={row} />, { locale: "fr" })

    expect(screen.getByText("Signalée")).toBeInTheDocument()
    expect(screen.getByText("Mise en place")).toBeInTheDocument()
    expect(screen.getByText("152 séries loguées")).toBeInTheDocument()
    expect(screen.getAllByText("Anglais").length).toBeGreaterThan(0)
  })
})
