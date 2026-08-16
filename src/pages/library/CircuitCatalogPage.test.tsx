import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { CatalogSeedRow } from "@/lib/previewCatalogCircuit"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

import { CircuitCatalogPage } from "./CircuitCatalogPage"

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
    tagline_fr: "Le WOD de Tom Holland.",
    tagline_en: "Tom Holland’s WOD.",
    story_fr: null,
    story_en: null,
    reference: null,
    ...overrides,
  }
}

const mockUseBenchmarkSeeds = vi.fn()

vi.mock("@/hooks/useBenchmarkSeeds", () => ({
  useBenchmarkSeeds: (enabled: boolean) => mockUseBenchmarkSeeds(enabled),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useNavigate: (): ReturnType<typeof actual.useNavigate> => mockNavigate,
  }
})

describe("CircuitCatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [
        makeSeed({ id: "zeus-id", slug: "zeus", label: "Zeus ⚡" }),
        makeSeed({ id: "cindy-id", slug: "cindy", label: "Cindy" }),
      ],
      isLoading: false,
      isError: false,
    })
  })

  it("renders each GymLogic seed as a link to its slug page", () => {
    renderWithProviders(<CircuitCatalogPage />, {
      initialEntries: ["/library/circuits"],
    })

    expect(mockUseBenchmarkSeeds).toHaveBeenCalledWith(true)
    expect(screen.getByRole("link", { name: "Zeus ⚡" })).toHaveAttribute(
      "href",
      "/library/circuits/zeus",
    )
    expect(screen.getByRole("link", { name: "Cindy" })).toHaveAttribute(
      "href",
      "/library/circuits/cindy",
    )
    expect(screen.queryByRole("button", { name: "Zeus ⚡" })).not.toBeInTheDocument()
    expect(screen.getAllByText("Tom Holland’s WOD.")).toHaveLength(2)
    expect(screen.getAllByText("As many rounds as possible.")).toHaveLength(2)
  })

  it("skips seeds whose slug is missing so the list never links to /null", () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [
        makeSeed({ id: "fork-id", slug: null, label: "Cindy (fork)" }),
        makeSeed({ id: "zeus-id", slug: "zeus", label: "Zeus ⚡" }),
      ],
      isLoading: false,
      isError: false,
    })

    renderWithProviders(<CircuitCatalogPage />, {
      initialEntries: ["/library/circuits"],
    })

    expect(screen.getByRole("link", { name: "Zeus ⚡" })).toHaveAttribute(
      "href",
      "/library/circuits/zeus",
    )
    expect(screen.queryByRole("link", { name: "Cindy (fork)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /null/i })).not.toBeInTheDocument()
  })

  it("sends the back control home, not to the programs list", async () => {
    renderWithProviders(<CircuitCatalogPage />, {
      initialEntries: ["/library/circuits"],
    })

    await userEvent.setup().click(screen.getByRole("button", { name: /back to workout/i }))
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("shows empty copy when the catalog query returns no seeds", () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    })

    renderWithProviders(<CircuitCatalogPage />, {
      initialEntries: ["/library/circuits"],
    })

    expect(screen.getByText("No circuits yet.")).toBeInTheDocument()
  })
})
