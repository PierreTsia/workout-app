import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import { MuscleRadarChart } from "./MuscleRadarChart"
import { toRadarRows } from "./profileChartData"
import { RADAR_CURRENT, RADAR_PRIOR } from "./fixtures"
import { restoreChartLayout, stubChartLayout } from "./chartTestLayout"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("MuscleRadarChart", () => {
  beforeEach(() => {
    stubChartLayout()
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("renders 13 MUSCLE_TAXONOMY axes inside ChartContainer", async () => {
    const rows = toRadarRows({ current: RADAR_CURRENT })
    expect(rows.map((row) => row.muscle)).toEqual([...MUSCLE_TAXONOMY])
    expect(rows).toHaveLength(13)

    renderWithProviders(
      <MuscleRadarChart series={{ current: RADAR_CURRENT }} />,
    )

    const radar = screen.getByRole("img", { name: /Muscle balance/i })
    expect(radar).toHaveAttribute("data-chart")
    await waitFor(() => {
      expect(
        radar.querySelectorAll(".recharts-polar-angle-axis-tick"),
      ).toHaveLength(MUSCLE_TAXONOMY.length)
    })
  })

  it("treats the prior series as optional and dashes it when present", async () => {
    const { unmount } = renderWithProviders(
      <MuscleRadarChart series={{ current: RADAR_CURRENT }} />,
    )
    const withoutPrior = screen.getByRole("img", { name: /Muscle balance/i })
    await waitFor(() => {
      expect(withoutPrior.querySelectorAll(".recharts-radar")).toHaveLength(1)
    })
    unmount()

    renderWithProviders(
      <MuscleRadarChart
        series={{ current: RADAR_CURRENT, prior: RADAR_PRIOR }}
      />,
    )
    const withPrior = screen.getByRole("img", { name: /Muscle balance/i })
    await waitFor(() => {
      expect(withPrior.querySelectorAll(".recharts-radar")).toHaveLength(2)
    })
    expect(withPrior.querySelector("[stroke-dasharray]")).not.toBeNull()
    expect(screen.getByText("Current")).toBeInTheDocument()
    expect(screen.getByText("Prior")).toBeInTheDocument()
    expect(withPrior.querySelector(".recharts-legend-wrapper")).toBeNull()
  })

  it("translates polar-axis ticks for an English reader", async () => {
    renderWithProviders(
      <MuscleRadarChart series={{ current: RADAR_CURRENT }} />,
      { locale: "en" },
    )

    const radar = screen.getByRole("img", { name: /Muscle balance/i })
    await waitFor(() => {
      expect(
        radar.querySelectorAll(".recharts-polar-angle-axis-tick"),
      ).toHaveLength(MUSCLE_TAXONOMY.length)
    })

    expect(radar).not.toHaveTextContent("Pectoraux")
    expect(radar).toHaveTextContent("Chest")
  })
})
