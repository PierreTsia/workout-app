import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { MixStackedChart } from "./MixStackedChart"
import { toMixPercentRows } from "./profileChartData"
import { MIX_7_CATEGORIES, MIX_7_SERIES } from "./fixtures"
import { restoreChartLayout, stubChartLayout } from "./chartTestLayout"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("MixStackedChart", () => {
  beforeEach(() => {
    stubChartLayout()
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("renders the 7-day Mix fixture as 100% stacks inside ChartContainer", async () => {
    const rows = toMixPercentRows(MIX_7_CATEGORIES, MIX_7_SERIES)
    expect(rows).toHaveLength(MIX_7_CATEGORIES.length)

    const mixedDays = MIX_7_CATEGORIES.filter((_, i) => {
      const types = [
        MIX_7_SERIES.programme[i],
        MIX_7_SERIES.quickWorkout[i],
        MIX_7_SERIES.circuits[i],
      ].filter((n) => n > 0)
      return types.length >= 2
    })
    expect(mixedDays.length).toBeGreaterThan(0)

    const sessionDays = rows.filter(
      (row) => row.programme + row.quickWorkout + row.circuits > 0,
    )
    expect(sessionDays).toHaveLength(3)
    sessionDays.forEach((row) => {
      expect(row.programme + row.quickWorkout + row.circuits).toBeCloseTo(100)
    })
    const restDays = rows.filter(
      (row) => row.programme + row.quickWorkout + row.circuits === 0,
    )
    expect(restDays).toHaveLength(4)

    renderWithProviders(
      <MixStackedChart categories={MIX_7_CATEGORIES} series={MIX_7_SERIES} />,
    )

    expect(document.querySelector("[data-chart]")).toBeInTheDocument()
    const mix = screen.getByRole("img", { name: "Mix" })
    await waitFor(() => {
      expect(
        mix.querySelectorAll(".recharts-cartesian-axis-tick"),
      ).toHaveLength(MIX_7_CATEGORIES.length)
    })
    expect(mix.querySelectorAll(".recharts-bar")).toHaveLength(3)
    expect(screen.getByText("Programme")).toBeInTheDocument()
    expect(screen.getByText("Quick Workout")).toBeInTheDocument()
    expect(screen.getByText("Circuits")).toBeInTheDocument()
  })
})
