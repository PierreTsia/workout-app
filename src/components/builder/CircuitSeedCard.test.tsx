import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"
import { CircuitSeedCard } from "./CircuitSeedCard"

const PULL_ID = "11111111-1111-4111-8111-111111111111"

function makeCindy(overrides: Partial<CatalogPreviewRow> = {}): CatalogPreviewRow {
  return {
    id: "cindy-id",
    slug: "cindy",
    aliases: ["holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [{ exercise_id: PULL_ID, amount: 5, weight: 0 }],
    },
    tagline_fr: "Le WOD de Tom Holland.",
    tagline_en: "Tom Holland’s WOD.",
    ...overrides,
  }
}

describe("CircuitSeedCard", () => {
  it("exposes the capitalized slug as the accessible name and calls onSelect on tap", async () => {
    const onSelect = vi.fn()
    renderWithProviders(
      <CircuitSeedCard seed={makeCindy()} onSelect={onSelect} />,
    )

    const card = screen.getByRole("button", { name: "Cindy" })
    expect(card).toBeInTheDocument()
    await userEvent.setup().click(card)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("shows AmrapLabel and the English tagline for an English reader", () => {
    renderWithProviders(
      <CircuitSeedCard seed={makeCindy()} onSelect={vi.fn()} />,
      { locale: "en" },
    )

    expect(screen.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(screen.getByText("As many rounds as possible.")).toBeInTheDocument()
    expect(screen.getByText("Tom Holland’s WOD.")).toBeInTheDocument()
    expect(screen.queryByText("Le WOD de Tom Holland.")).not.toBeInTheDocument()
  })

  it("shows the French tagline for a French reader", () => {
    renderWithProviders(
      <CircuitSeedCard seed={makeCindy()} onSelect={vi.fn()} />,
      { locale: "fr" },
    )

    expect(screen.getByText("Le WOD de Tom Holland.")).toBeInTheDocument()
    expect(screen.queryByText("Tom Holland’s WOD.")).not.toBeInTheDocument()
  })

  it("disables the card and shows a spinner while pending", () => {
    renderWithProviders(
      <CircuitSeedCard seed={makeCindy()} onSelect={vi.fn()} pending />,
    )

    expect(screen.getByRole("button", { name: "Cindy" })).toBeDisabled()
  })
})
