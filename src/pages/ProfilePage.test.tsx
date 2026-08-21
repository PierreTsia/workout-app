import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProfilePage } from "./ProfilePage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

function withinRhythm() {
  const heading = screen.getByRole("heading", { name: "Rhythm" })
  const card = heading.parentElement?.parentElement
  if (!card) throw new Error("expected Rhythm card")
  return within(card)
}

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

  it("shows seven labeled weekdays on the 7d Rhythm chart", () => {
    renderWithProviders(<ProfilePage />)

    const rhythm = withinRhythm()
    for (const day of WEEKDAYS_EN) {
      expect(rhythm.getByText(day)).toBeInTheDocument()
    }
    expect(rhythm.getAllByRole("listitem")).toHaveLength(7)
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

  it("lays out 100d Rhythm as a labeled week grid, not wrapping dots", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)
    await user.click(screen.getByRole("radio", { name: "100d" }))

    const rhythm = withinRhythm()
    expect(rhythm.getByText("12 weeks")).toBeInTheDocument()
    for (let n = 1; n <= 12; n++) {
      expect(rhythm.getByText(`W${n}`)).toBeInTheDocument()
    }
    expect(rhythm.getAllByRole("listitem")).toHaveLength(12)

    const list = rhythm.getByRole("list", { name: "Rhythm" })
    const colMatch = list.className.match(/grid-cols-(\d+)/)
    expect(colMatch).not.toBeNull()
    const cols = Number(colMatch?.[1])
    expect(12 / cols).toBeGreaterThan(1)
    expect(list.className).not.toMatch(/flex-wrap/)
  })

  it("keeps labeled empty rings on the empty fixture", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)
    await user.click(screen.getByRole("radio", { name: "Empty" }))

    const rhythm = withinRhythm()
    for (const day of WEEKDAYS_EN) {
      expect(
        rhythm.getByRole("listitem", { name: `${day}, No session` }),
      ).toBeInTheDocument()
    }
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

  it("renders a Tonnage bar chart on the Pierre fixture", async () => {
    renderWithProviders(<ProfilePage />)

    expect(screen.getByRole("heading", { name: "Tonnage" })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("img", { name: /Tonnage/ })).toBeInTheDocument()
    })
  })

  it("hides the Tonnage bar chart on the empty fixture", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole("radio", { name: "Empty" }))

    expect(screen.getByRole("heading", { name: "Tonnage" })).toBeInTheDocument()
    expect(screen.getByText("No loaded sets in this window.")).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: /Tonnage/ })).not.toBeInTheDocument()
  })

  it("matches Tonnage bar categories to the Mix grain when toggling 7d to 1y", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    const weekChart = await screen.findByRole("img", { name: /Tonnage/ })
    await waitFor(() => {
      expect(
        weekChart.querySelectorAll(".recharts-cartesian-axis-tick"),
      ).toHaveLength(7)
    })

    await user.click(screen.getByRole("radio", { name: "1y" }))

    const yearChart = await screen.findByRole("img", { name: /Tonnage/ })
    await waitFor(() => {
      expect(
        yearChart.querySelectorAll(".recharts-cartesian-axis-tick"),
      ).toHaveLength(12)
    })
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
