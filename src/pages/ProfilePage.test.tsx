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
    vi.useRealTimers()
  })

  it("shows Pierre tenure from first session instead of a fake streak", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 21))
    renderWithProviders(<ProfilePage />)

    expect(screen.queryByText(/Streak/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mar 12, 2024/)).not.toBeInTheDocument()
    expect(screen.getByText("Active since 2½ years")).toBeInTheDocument()
  })

  it("hides tenure on the empty fixture", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)
    await user.click(screen.getByRole("radio", { name: "Empty" }))

    expect(screen.queryByText(/Streak/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Active since/)).not.toBeInTheDocument()
  })

  it("formats Pierre tenure in French", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 21))
    renderWithProviders(<ProfilePage />, { locale: "fr" })

    expect(screen.queryByText(/Série ·/)).not.toBeInTheDocument()
    expect(screen.queryByText(/12 mars 2024/)).not.toBeInTheDocument()
    expect(screen.getByText("Actif depuis 2 ans et demi")).toBeInTheDocument()
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

  it("lets Rhythm span both columns of the Mix row", () => {
    renderWithProviders(<ProfilePage />)

    const mix = screen.getByRole("heading", { name: "Mix" })
    const rhythm = screen.getByRole("heading", { name: "Rhythm" })
    const mixCell = mix.closest("[class*='col-span']")
    const rhythmCell = rhythm.closest("[class*='col-span']")
    const grid = mixCell?.parentElement

    expect(grid?.className).toMatch(/lg:grid-cols-2/)
    expect(mixCell?.className).toMatch(/lg:col-span-2/)
    expect(rhythmCell?.className).toMatch(/lg:col-span-2/)
    expect(mixCell).not.toBe(rhythmCell)
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

  it("shows signed pulse vs-prior deltas and keeps prescribed comparison neutral", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("3h 20")).toBeInTheDocument()
    expect(screen.getByText("40 min")).toBeInTheDocument()

    const up = screen.getByText("+1 vs prior")
    expect(up.closest("p")?.className).toMatch(/emerald/)
    expect(up.closest("p")?.querySelector(".lucide-arrow-up")).not.toBeNull()

    const down = screen.getByText("-40 min vs prior")
    expect(down.closest("p")?.className).toMatch(/destructive/)
    expect(down.closest("p")?.querySelector(".lucide-arrow-down")).not.toBeNull()

    const prescribed = screen.getByRole("link", { name: /vs 60 min prescribed/i })
    expect(prescribed).toHaveAttribute("href", "/account")
    expect(prescribed.closest("p")?.className).not.toMatch(/emerald|destructive/)

    await user.click(screen.getByRole("radio", { name: "All time" }))
    expect(screen.queryByText("+1 vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText("-40 min vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText("even vs prior")).not.toBeInTheDocument()
  })

  it("restyles Mix/Rhythm grain when toggling 7d to 30d", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    expect(screen.getByText("Last 7 days · target 4 d / wk")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "30d" }))
    expect(screen.getByText("5 weeks · target 4 d / wk")).toBeInTheDocument()
    expect(screen.queryByText("Last 7 days · target 4 d / wk")).not.toBeInTheDocument()
  })

  it("lays out 100d Rhythm as 12 target-dot week clusters, not a weekday grid", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)
    await user.click(screen.getByRole("radio", { name: "100d" }))

    const rhythm = withinRhythm()
    expect(rhythm.getByText("12 weeks · target 4 d / wk")).toBeInTheDocument()
    expect(rhythm.queryByText("Mon")).not.toBeInTheDocument()
    expect(rhythm.queryByText("W1")).not.toBeInTheDocument()
    expect(rhythm.getByText("W-11")).toBeInTheDocument()
    expect(rhythm.getByText("W-8 = deload (2 sessions)")).toBeInTheDocument()
    expect(rhythm.getByText("W")).toBeInTheDocument()

    const groups = rhythm.getAllByRole("listitem")
    expect(groups).toHaveLength(12)

    const filledCounts = groups.map(
      (group) => group.querySelectorAll("[data-rhythm-dot='on']").length,
    )
    const emptyCounts = groups.map(
      (group) => group.querySelectorAll("[data-rhythm-dot='off']").length,
    )
    groups.forEach((group, i) => {
      const dots = group.querySelectorAll("[data-rhythm-dot]").length
      expect(dots).toBe(Math.max(4, filledCounts[i]!))
      expect(filledCounts[i]! + emptyCounts[i]!).toBe(dots)
    })
    expect(filledCounts.some((n) => n === 4)).toBe(true)
    expect(filledCounts.some((n) => n > 4)).toBe(true)
    expect(filledCounts.some((n) => n > 0 && n < 4)).toBe(true)
    expect(filledCounts.every((n) => n !== 7)).toBe(true)

    const list = rhythm.getByRole("list", { name: "Rhythm" })
    expect(list.className).toMatch(/flex/)
    expect(list.className).not.toMatch(/grid-cols/)
    expect(list.className).not.toMatch(/flex-wrap/)
  })

  it("renders French 100d Rhythm as S- week clusters with a cible meta", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { locale: "fr" })
    await user.click(screen.getByRole("radio", { name: "100j" }))

    const heading = screen.getByRole("heading", { name: "Rythme" })
    const card = heading.parentElement?.parentElement
    if (!card) throw new Error("expected Rythme card")
    const rhythm = within(card)

    expect(rhythm.getByText("12 semaines · cible 4 j / sem")).toBeInTheDocument()
    expect(rhythm.getByText("S-11")).toBeInTheDocument()
    expect(rhythm.getByText("S-8 = deload (2 séances)")).toBeInTheDocument()
    expect(rhythm.getAllByRole("listitem")).toHaveLength(12)
    const frFilled = rhythm.getAllByRole("listitem").map(
      (group) => group.querySelectorAll("[data-rhythm-dot='on']").length,
    )
    expect(frFilled.some((n) => n > 4)).toBe(true)
    rhythm.getAllByRole("listitem").forEach((group, i) => {
      const dots = group.querySelectorAll("[data-rhythm-dot]").length
      expect(dots).toBe(Math.max(4, frFilled[i]!))
    })
  })

  it("keeps target-dot clusters on 30d Rhythm", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole("radio", { name: "30d" }))
    const rhythm30 = withinRhythm()
    expect(rhythm30.getAllByRole("listitem")).toHaveLength(5)
    expect(rhythm30.getByText("W-4")).toBeInTheDocument()
    rhythm30.getAllByRole("listitem").forEach((group) => {
      expect(group.querySelectorAll("[data-rhythm-dot]")).toHaveLength(4)
    })
  })

  it("switches 1y and all-time Rhythm from dots to frequency bars", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole("radio", { name: "1y" }))
    const rhythmYear = withinRhythm()
    expect(rhythmYear.getByText("12 months · target 4 d / wk")).toBeInTheDocument()
    expect(rhythmYear.queryByRole("list", { name: "Rhythm" })).not.toBeInTheDocument()
    const yearChart = await rhythmYear.findByRole("img", { name: "Rhythm" })
    await waitFor(() => {
      expect(yearChart.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(
        12,
      )
    })
    expect(rhythmYear.getByText("Jan")).toBeInTheDocument()
    expect(rhythmYear.getByText("Dec")).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "All time" }))
    const rhythmAll = withinRhythm()
    expect(rhythmAll.getByText("By year · target 4 d / wk")).toBeInTheDocument()
    expect(rhythmAll.queryByRole("list", { name: "Rhythm" })).not.toBeInTheDocument()
    const allChart = await rhythmAll.findByRole("img", { name: "Rhythm" })
    await waitFor(() => {
      expect(allChart.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(3)
    })
    expect(rhythmAll.getByText("2024")).toBeInTheDocument()
  })

  it("hides the Rhythm chart on the empty fixture", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)
    await user.click(screen.getByRole("radio", { name: "Empty" }))

    const rhythm = withinRhythm()
    expect(rhythm.getByText("No sessions in this window.")).toBeInTheDocument()
    expect(rhythm.queryByRole("list", { name: "Rhythm" })).not.toBeInTheDocument()
    expect(rhythm.queryByText("Mon")).not.toBeInTheDocument()
    expect(rhythm.queryByText("W-11")).not.toBeInTheDocument()
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

  it("shows date and description on the two hero badges, not the recent strip", () => {
    renderWithProviders(<ProfilePage />)

    expect(screen.getAllByText(/Unlocked on/)).toHaveLength(2)
    expect(
      screen.getAllByText("GymLogic circuit runs (1+ round)"),
    ).toHaveLength(2)
    expect(document.querySelectorAll(".badge-frame.h-36")).toHaveLength(2)
    expect(document.querySelectorAll(".badge-frame.h-10")).toHaveLength(3)
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

  it("does not render hero Succès medals on empty or loading", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole("radio", { name: "Empty" }))
    expect(screen.queryByRole("button", { name: "No Break" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Circuit Star" })).not.toBeInTheDocument()
    expect(document.querySelector(".badge-frame.h-36")).toBeNull()

    await user.click(screen.getByRole("radio", { name: "Loading" }))
    expect(screen.queryByRole("button", { name: "No Break" })).not.toBeInTheDocument()
    expect(document.querySelector(".badge-frame.h-36")).toBeNull()
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
