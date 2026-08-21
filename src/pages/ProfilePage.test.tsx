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

function sectionCard(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name })
  const card = heading.closest(".bg-card")
  if (!(card instanceof HTMLElement)) throw new Error(`expected ${name} card`)
  return card
}

function withinRhythm() {
  return within(sectionCard("Rhythm"))
}

function withinRecords() {
  return within(sectionCard("Records"))
}

function withinBalance() {
  return within(sectionCard("Balance"))
}

async function chooseWindow(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole("combobox", { name: /^(Window|Fenêtre)$/ }))
  await user.click(await screen.findByRole("option", { name: label }))
}

const routerSources = import.meta.glob("../router/index.tsx", {
  query: "?raw",
  eager: true,
  import: "default",
})

describe("ProfilePage T0 fixtures", () => {
  beforeEach(() => {
    stubChartLayout()
    Object.assign(Element.prototype, {
      hasPointerCapture: () => false,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      scrollIntoView: () => undefined,
    })
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    restoreChartLayout()
    vi.useRealTimers()
  })

  it("exposes a back control so the page is not a dead end", () => {
    renderWithProviders(<ProfilePage />)

    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument()
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

  it("paints the equipped title in the highest-finish rank color", () => {
    renderWithProviders(<ProfilePage />)

    const hero = within(screen.getByRole("region", { name: "Pierre" }))
    const title = hero.getByText("Circuit Star")
    expect(title.className).toMatch(/italic/)
    expect(title.className).toMatch(/purple/)
    expect(hero.getByText("PT").closest("[class*='ring-purple']")).not.toBeNull()
  })

  it("shows seven labeled weekdays on the 7d Rhythm chart", () => {
    renderWithProviders(<ProfilePage />)

    const rhythm = withinRhythm()
    for (const day of WEEKDAYS_EN) {
      expect(rhythm.getByText(day)).toBeInTheDocument()
    }
    expect(rhythm.getAllByRole("listitem")).toHaveLength(7)
    const dots = rhythm.getByRole("list", { name: "Rhythm" }).querySelectorAll("[data-rhythm-dot]")
    expect(dots).toHaveLength(7)
    expect([...dots].every((dot) => /\bsize-(5|6|7|8)\b/.test(dot.className))).toBe(true)
  })

  it("promotes Records KPIs to pulse cards with vs-prior deltas", () => {
    renderWithProviders(<ProfilePage />)

    const records = withinRecords()
    const prs = records.getByText("11")
    expect(prs.className).toMatch(/text-(4|5)xl/)
    expect(records.getByText("8").className).toMatch(/text-(4|5)xl/)
    expect(records.getByText("2d").className).toMatch(/text-(4|5)xl/)

    const prDelta = records.getByText("+3 vs prior")
    expect(prDelta.closest("p")?.className).toMatch(/emerald/)
    expect(records.getByText("+2 vs prior")).toBeInTheDocument()
    expect(records.getByText("3d sooner vs prior")).toBeInTheDocument()
  })

  it("promotes Circuits KPIs to pulse cards with vs-prior deltas", () => {
    renderWithProviders(<ProfilePage />)

    const circuits = within(sectionCard("Circuits"))

    expect(circuits.getByText("11").className).toMatch(/text-3xl/)
    expect(circuits.getByText("3", { selector: ".text-3xl" }).className).toMatch(
      /text-3xl/,
    )
    expect(circuits.getByText("1").className).toMatch(/text-3xl/)

    const up = circuits.getByText("+4 vs prior")
    expect(up.closest("p")?.className).toMatch(/emerald/)
    expect(circuits.getAllByText("even vs prior")).toHaveLength(2)
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

  it("puts Mix and Rhythm side by side on the large row", () => {
    renderWithProviders(<ProfilePage />)

    const mixCell = sectionCard("Mix").parentElement
    const rhythmCell = sectionCard("Rhythm").parentElement
    const grid = mixCell?.parentElement

    expect(grid?.className).toMatch(/lg:grid-cols-2/)
    expect(mixCell?.parentElement).toBe(rhythmCell?.parentElement)
    expect(mixCell).not.toBe(rhythmCell)
    expect(mixCell?.className).not.toMatch(/col-span-2/)
    expect(rhythmCell?.className).not.toMatch(/col-span-2/)
  })

  it("exposes five window crans and hides vs-prior on All time", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    expect(screen.getByText("+1 vs prior")).toBeInTheDocument()

    const windowSelect = screen.getByRole("combobox", { name: "Window" })
    expect(windowSelect).toHaveTextContent("7d")
    await user.click(windowSelect)
    for (const label of ["7d", "30d", "100d", "1y", "All time"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument()
    }
    await user.click(screen.getByRole("option", { name: "All time" }))

    expect(screen.queryByText("+1 vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText("+3 vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText("+4 vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText(/Also PPL/)).not.toBeInTheDocument()
    expect(withinBalance().getByText("67 / 100")).toBeInTheDocument()
    expect(withinBalance().queryByText("+4 vs prior")).not.toBeInTheDocument()
  })

  it("shows signed pulse vs-prior deltas and keeps prescribed comparison neutral", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    expect(
      screen.getByText("5", { selector: ".text-5xl" }),
    ).toBeInTheDocument()
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

    await chooseWindow(user, "All time")
    expect(screen.queryByText("+1 vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText("-40 min vs prior")).not.toBeInTheDocument()
    expect(screen.queryByText("even vs prior")).not.toBeInTheDocument()
  })

  it("restyles Mix/Rhythm grain when toggling 7d to 30d", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    expect(screen.getByText("Last 7 days · target 4 d / wk")).toBeInTheDocument()
    await chooseWindow(user, "30d")
    expect(screen.getByText("5 weeks · target 4 d / wk")).toBeInTheDocument()
    expect(screen.queryByText("Last 7 days · target 4 d / wk")).not.toBeInTheDocument()
  })

  it("lays out 100d Rhythm as frequency bars with a target line", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)
    await chooseWindow(user, "100d")

    const rhythm = withinRhythm()
    expect(rhythm.getByText("12 weeks · target 4 d / wk")).toBeInTheDocument()
    expect(rhythm.queryByRole("list", { name: "Rhythm" })).not.toBeInTheDocument()
    expect(rhythm.queryByRole("grid", { name: /heatmap calendar/i })).not.toBeInTheDocument()
    const chart = await rhythm.findByRole("img", { name: "Rhythm" })
    await waitFor(() => {
      expect(chart.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(12)
    })
    expect(rhythm.getByText("W-11")).toBeInTheDocument()
    expect(rhythm.getByText("W")).toBeInTheDocument()
    expect(chart.querySelector(".recharts-reference-line")).not.toBeNull()
    expect(rhythm.getByText("W-8 = deload (2 sessions)")).toBeInTheDocument()
  })

  it("renders French 100d Rhythm bars with a cible meta", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { locale: "fr" })
    await chooseWindow(user, "100j")

    const rhythm = within(sectionCard("Rythme"))

    expect(rhythm.getByText("12 semaines · cible 4 j / sem")).toBeInTheDocument()
    expect(rhythm.queryByRole("list", { name: "Rythme" })).not.toBeInTheDocument()
    const chart = await rhythm.findByRole("img", { name: "Rythme" })
    await waitFor(() => {
      expect(chart.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(12)
    })
    expect(rhythm.getByText("S-11")).toBeInTheDocument()
    expect(rhythm.getByText("S-8 = deload (2 séances)")).toBeInTheDocument()
  })

  it("keeps target-dot clusters on 30d Rhythm", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await chooseWindow(user, "30d")
    const rhythm30 = withinRhythm()
    expect(rhythm30.getAllByRole("listitem")).toHaveLength(5)
    expect(rhythm30.getByText("W-4")).toBeInTheDocument()
    rhythm30.getAllByRole("listitem").forEach((group) => {
      expect(group.querySelectorAll("[data-rhythm-dot]")).toHaveLength(4)
    })
  })

  it("switches 1y and all-time Rhythm to frequency bars with a target line", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await chooseWindow(user, "1y")
    const rhythmYear = withinRhythm()
    expect(rhythmYear.getByText("12 months · target 4 d / wk")).toBeInTheDocument()
    expect(rhythmYear.queryByRole("list", { name: "Rhythm" })).not.toBeInTheDocument()
    expect(rhythmYear.queryByRole("grid", { name: /heatmap calendar/i })).not.toBeInTheDocument()
    const yearChart = await rhythmYear.findByRole("img", { name: "Rhythm" })
    await waitFor(() => {
      expect(yearChart.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(12)
    })
    expect(rhythmYear.getByText("Jan")).toBeInTheDocument()
    expect(rhythmYear.getByText("Dec")).toBeInTheDocument()
    expect(yearChart.querySelector(".recharts-reference-line")).not.toBeNull()

    await chooseWindow(user, "All time")
    const rhythmAll = withinRhythm()
    expect(rhythmAll.getByText("By year · target 4 d / wk")).toBeInTheDocument()
    expect(rhythmAll.queryByRole("grid", { name: /heatmap calendar/i })).not.toBeInTheDocument()
    const allChart = await rhythmAll.findByRole("img", { name: "Rhythm" })
    await waitFor(() => {
      expect(allChart.querySelectorAll(".recharts-cartesian-axis-tick")).toHaveLength(3)
    })
    expect(rhythmAll.getByText("2024")).toBeInTheDocument()
    expect(allChart.querySelector(".recharts-reference-line")).not.toBeNull()
  })

  it("hides the Rhythm chart on the empty fixture", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)
    await user.click(screen.getByRole("radio", { name: "Empty" }))

    const rhythm = withinRhythm()
    expect(rhythm.getByText("No sessions in this window.")).toBeInTheDocument()
    expect(rhythm.queryByRole("list", { name: "Rhythm" })).not.toBeInTheDocument()
    expect(rhythm.queryByRole("grid", { name: /heatmap calendar/i })).not.toBeInTheDocument()
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

  it("shows Unlocked-on copy on the two hero badges; recent rows carry date and description", () => {
    renderWithProviders(<ProfilePage />)

    expect(screen.getAllByText(/Unlocked on/)).toHaveLength(2)
    expect(document.querySelectorAll(".badge-frame.h-36")).toHaveLength(2)
    expect(document.querySelectorAll(".badge-frame.h-10")).toHaveLength(3)
    const recent = screen.getByRole("list", { name: "Recent" })
    expect(recent?.textContent).toMatch(/Aug 10/)
    expect(recent?.textContent).toContain("Best Cindy score in rounds")
    expect(recent?.textContent).toContain("GymLogic circuit runs (1+ round)")
    expect(recent?.textContent).toContain("Cumulative Pompes-family reps")
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
    expect(screen.getByRole("button", { name: "About Mix" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "About Balance" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "About Window" })).toBeInTheDocument()
    expect(screen.getByText("18.4 t")).toBeInTheDocument()

    const balance = withinBalance()
    expect(balance.getByText("67 / 100")).toBeInTheDocument()
    expect(balance.getByText("Needs attention")).toBeInTheDocument()
    const bar = balance.getByRole("progressbar", { name: "67 / 100" })
    expect(bar).toHaveAttribute("aria-valuenow", "67")
    const delta = balance.getByText("+4 vs prior")
    expect(delta.className).toMatch(/emerald/)

    const ranks = balance.getByRole("list", { name: "Sets · 1 / 0.5" })
    expect(within(ranks).getAllByRole("listitem")[0]).toHaveTextContent("Chest")
    expect(within(ranks).getAllByRole("listitem")[0]).toHaveTextContent("18")
    expect(within(ranks).getAllByRole("listitem").at(-1)).toHaveTextContent(
      "Adductors",
    )
    expect(balance.queryByText(/kg/i)).not.toBeInTheDocument()
    expect(
      balance.getByRole("img", { name: /Muscle balance/ }).parentElement
        ?.parentElement?.className,
    ).toMatch(/grid-cols-\[minmax/)

    const tonnageDelta = within(sectionCard("Tonnage")).getByText("+1.2 t vs prior")
    expect(tonnageDelta.className).toMatch(/emerald/)
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

    await chooseWindow(user, "1y")

    const yearChart = await screen.findByRole("img", { name: /Tonnage/ })
    await waitFor(() => {
      expect(
        yearChart.querySelectorAll(".recharts-cartesian-axis-tick"),
      ).toHaveLength(12)
    })
  })

  it("scores Circuits by mode, with run count and window best — not last run", async () => {
    renderWithProviders(<ProfilePage />)

    const circuits = within(sectionCard("Circuits"))

    expect(circuits.queryByText("8+2 · 9+0 · 10+1")).not.toBeInTheDocument()
    expect(circuits.getByText("Cindy")).toBeInTheDocument()
    expect(circuits.getByText("Athena")).toBeInTheDocument()
    expect(circuits.getByText("Force")).toBeInTheDocument()
    expect(circuits.getByText("10+1")).toBeInTheDocument()
    expect(circuits.getByText("5+4")).toBeInTheDocument()
    expect(circuits.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(circuits.getByText("AMRAP 12 min")).toBeInTheDocument()
    expect(circuits.getByText("4 rounds")).toBeInTheDocument()
    expect(circuits.getByText("7:58")).toBeInTheDocument()
    expect(circuits.queryByText("9+0")).not.toBeInTheDocument()
    expect(circuits.queryByText("8:18")).not.toBeInTheDocument()
    expect(within(circuits.getAllByRole("listitem")[0]).getByText("5")).toBeInTheDocument()
    expect(within(circuits.getAllByRole("listitem")[0]).getByText("PB")).toBeInTheDocument()
    expect(circuits.queryByText("AMRAP 4 min")).not.toBeInTheDocument()
    expect(await circuits.findByRole("img", { name: "Cindy score" })).toBeInTheDocument()
    expect(circuits.getByRole("img", { name: "Athena score" })).toBeInTheDocument()
    expect(circuits.getByRole("img", { name: "Force score" })).toBeInTheDocument()
    expect(
      circuits
        .getAllByRole("listitem")
        .every((row) =>
          row.className.includes("grid-cols-[minmax(0,1fr)_3.25rem_8rem_6rem]"),
        ),
    ).toBe(true)
  })

  it("lets the window selector rank Regulars", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    const regulars = within(sectionCard("Regulars"))
    expect(regulars.getByText("Most logged · 7d")).toBeInTheDocument()
    expect(regulars.getAllByRole("listitem")[0]).toHaveTextContent("Squat")
    expect(regulars.getByText("48")).toBeInTheDocument()
    expect(regulars.queryByText("400")).not.toBeInTheDocument()

    await chooseWindow(user, "100d")

    expect(regulars.getByText("Most logged · 100d")).toBeInTheDocument()
    expect(regulars.getAllByRole("listitem")[0]).toHaveTextContent("Pull-up")
    expect(regulars.getByText("400")).toBeInTheDocument()
  })

  it("treats empty and loading as distinct fixture modes", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole("radio", { name: "Empty" }))
    expect(
      screen.getByText("Not enough sessions for a score."),
    ).toBeInTheDocument()
    expect(screen.queryByText("67 / 100")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("list", { name: /sets · 1 \/ 0\.5/i }),
    ).not.toBeInTheDocument()
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
