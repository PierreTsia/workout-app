import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { RecordsComboChart } from "./RecordsComboChart"
import { toRecordsComboRows } from "./profileChartData"
import { COMBO_CATEGORIES, COMBO_SERIES } from "./fixtures"
import { restoreChartLayout, stubChartLayout } from "./chartTestLayout"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("RecordsComboChart", () => {
  beforeEach(() => {
    stubChartLayout()
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("keeps a missing RIR 0 rate as a gap on a dual-axis combo", async () => {
    const rows = toRecordsComboRows(COMBO_CATEGORIES, COMBO_SERIES)
    expect(rows).toHaveLength(COMBO_CATEGORIES.length)
    expect(rows[1]?.rir0).toBeNull()
    expect(rows.some((row) => row.rir0 === 0)).toBe(false)

    renderWithProviders(
      <RecordsComboChart categories={COMBO_CATEGORIES} series={COMBO_SERIES} />,
    )

    const combo = screen.getByRole("img", { name: /PRs and RIR 0/i })
    await waitFor(() => {
      expect(combo.querySelectorAll(".recharts-yAxis")).toHaveLength(2)
    })
    expect(combo.querySelectorAll(".recharts-dot")).toHaveLength(2)
  })
})
