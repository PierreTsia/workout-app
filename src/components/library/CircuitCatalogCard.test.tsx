import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { CatalogSeedRow } from "@/lib/previewCatalogCircuit"
import { CircuitCatalogCard } from "./CircuitCatalogCard"

const PULL_ID = "11111111-1111-4111-8111-111111111111"

function makeSeed(overrides: Partial<CatalogSeedRow> = {}): CatalogSeedRow {
  return {
    id: "cindy-id",
    slug: "cindy",
    label: "Cindy",
    aliases: ["holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [{ exercise_id: PULL_ID, amount: 5, weight: 0 }],
    },
    tagline_fr: "Le WOD de Tom Holland. 20 min.",
    tagline_en: "Tom Holland’s WOD. 20 min.",
    story_fr:
      "Cinq tractions, dix pompes, quinze squats. Autant de tours que possible.",
    story_en:
      "Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible.",
    reference: { name: "Tom Holland", score: "27" },
    ...overrides,
  }
}

describe("CircuitCatalogCard", () => {
  it("sells the seed with tagline, story, and a glossed AMRAP cap", () => {
    renderWithProviders(
      <CircuitCatalogCard
        seed={makeSeed({ slug: "cindy", label: "Cindy" })}
        to="/library/circuits/cindy"
      />,
      { locale: "en" },
    )

    const card = screen.getByRole("link", { name: "Cindy" })
    expect(card).toHaveAttribute("href", "/library/circuits/cindy")
    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(
      screen.getByText(/Five pull-ups, ten push-ups, fifteen squats/),
    ).toBeInTheDocument()
    expect(screen.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(screen.getByText("As many rounds as possible.")).toBeInTheDocument()
  })

  it("shows the French tagline and story for a French reader", () => {
    renderWithProviders(
      <CircuitCatalogCard
        seed={makeSeed({ slug: "zeus", label: "Zeus ⚡" })}
        to="/library/circuits/zeus"
      />,
      { locale: "fr" },
    )

    expect(screen.getByText("Le WOD de Tom Holland. 20 min.")).toBeInTheDocument()
    expect(screen.getByText(/Cinq tractions, dix pompes/)).toBeInTheDocument()
    expect(screen.queryByText("Tom Holland’s WOD. 20 min.")).not.toBeInTheDocument()
  })
})
