import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProfilePage } from "./ProfilePage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const routerSources = import.meta.glob("../router/index.tsx", {
  query: "?raw",
  eager: true,
  import: "default",
})

describe("ProfilePage T0 fixtures", () => {
  beforeEach(() => {
    stubChartLayout()
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("renders Mix and Rhythm above Records on the Pierre fixture", () => {
    renderWithProviders(<ProfilePage />)

    const mix = screen.getByRole("heading", { name: "Mix" })
    const rhythm = screen.getByRole("heading", { name: "Rhythm" })
    const records = screen.getByRole("heading", { name: "Records" })

    expect(
      mix.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      rhythm.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("exposes five window crans and hides vs-prior on All time", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    const windowGroup = screen.getByRole("radiogroup", { name: "Window" })
    for (const label of ["7d", "30d", "100d", "1y", "All time"]) {
      expect(windowGroup).toHaveTextContent(label)
    }

    expect(screen.getByText("+1 vs prior")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "All time" }))
    expect(screen.queryByText("+1 vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText(/Also PPL/)).not.toBeInTheDocument()
  })

  it("restyles Mix/Rhythm grain when toggling 7d to 30d", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    expect(screen.getByText("Last 7 days")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "30d" }))
    expect(screen.getByText("5 weeks")).toBeInTheDocument()
    expect(screen.queryByText("Last 7 days")).not.toBeInTheDocument()
  })

  it("renders Latest, Highest, and recently earned as illustrated badges", () => {
    renderWithProviders(<ProfilePage />)

    expect(screen.getByRole("img", { name: "No Break" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Circuit Star" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Baby Spidey" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "First Lap" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/achievements",
    )
    expect(screen.getByRole("button", { name: "No Break" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Circuit Star" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Baby Spidey" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "First Lap" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nose to Floor" })).toBeInTheDocument()
    expect(document.querySelectorAll(".badge-frame-gold").length).toBeGreaterThan(0)
    expect(document.querySelectorAll(".badge-frame-diamond").length).toBeGreaterThan(0)
    expect(document.querySelectorAll(".badge-frame-bronze").length).toBe(3)
  })

  it("opens the achievement detail drawer when a Succès medal is clicked", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole("button", { name: "No Break" }))

    expect(screen.getByRole("heading", { name: "No Break" })).toBeInTheDocument()
  })

  it("fills Équilibre and Tonnage on the Pierre ~100d fixture", () => {
    renderWithProviders(<ProfilePage />)

    expect(
      screen.queryByText("Not enough sessions for a score."),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tonnage" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Balance" })).toBeInTheDocument()
    expect(screen.getByText("18.4 t")).toBeInTheDocument()
  })

  it("treats empty and loading as distinct fixture modes", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole("radio", { name: "Empty" }))
    expect(
      screen.getByText("Not enough sessions for a score."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: "Baby Spidey" })).not.toBeInTheDocument()
    expect(screen.queryByText("Cindy bronze")).not.toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "Loading" }))
    expect(
      screen.queryByText("Not enough sessions for a score."),
    ).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(
      0,
    )
  })
})

describe("/profile route", () => {
  it("is nested under AdminGuard", () => {
    const [routerSource] = Object.values(routerSources)
    if (typeof routerSource !== "string") {
      throw new Error("expected router source")
    }

    expect(routerSource).toMatch(
      /element: <AdminGuard \/>[\s\S]*path: "\/profile"/,
    )
    expect(routerSource).not.toMatch(
      /path: "\/profile"[\s\S]*element: <AdminGuard \/>/,
    )
  })
})

