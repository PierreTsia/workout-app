import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { CircuitLedgerRow } from "./CircuitLedgerRow"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("CircuitLedgerRow", () => {
  beforeEach(() => {
    stubChartLayout()
  })

  afterEach(() => {
    restoreChartLayout()
  })
  it("hides the sparkline with a single run and still shows best score and run count", () => {
    renderWithProviders(
      <ul>
        <CircuitLedgerRow
          row={{
            mode: "amrap",
            fingerprint: "amrap|1200|cindy",
            name: "Cindy",
            minutes: 20,
            pb: false,
            runCount: 1,
            best: { fullRounds: 10, leftover: 1, leftoverName: "pull-ups" },
            sparkValues: [10],
          }}
        />
      </ul>,
    )

    expect(screen.getByText("Cindy")).toBeInTheDocument()
    expect(screen.getByText("Cindy").className).toMatch(/min-w-0/)
    expect(screen.getByText("Cindy").className).toMatch(/truncate/)
    expect(screen.getByRole("listitem").className).toMatch(/minmax\(0,1fr\)/)
    expect(screen.getByText("10+1")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: /Cindy score/ })).not.toBeInTheDocument()
  })

  it("scores Tours as completion time, not an AMRAP leftover", () => {
    renderWithProviders(
      <ul>
        <CircuitLedgerRow
          row={{
            mode: "rounds",
            fingerprint: "rounds|4|force",
            name: "Force",
            rounds: 4,
            pb: true,
            runCount: 3,
            best: { seconds: 478 },
            sparkValues: [520, 478, 498],
          }}
        />
      </ul>,
    )

    expect(screen.getByText("Force")).toBeInTheDocument()
    expect(screen.getByText("PB")).toBeInTheDocument()
    expect(screen.getByText("7:58")).toBeInTheDocument()
    expect(screen.queryByText("10+1")).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Force score/ })).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: /Force score: 8:40, 7:58, 8:18/ }),
    ).toBeInTheDocument()
  })

  it("labels AMRAP spark points as rounds, not a For Time clock", () => {
    renderWithProviders(
      <ul>
        <CircuitLedgerRow
          row={{
            mode: "amrap",
            fingerprint: "amrap|1200|cindy",
            name: "Cindy",
            minutes: 20,
            pb: false,
            runCount: 3,
            best: { fullRounds: 10, leftover: 1, leftoverName: "pull-ups" },
            sparkValues: [8, 10, 9],
          }}
        />
      </ul>,
      { locale: "fr" },
    )

    expect(
      screen.getByRole("img", { name: /Cindy score: 8 tours, 10 tours, 9 tours/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: /8:00/ })).not.toBeInTheDocument()
  })
})

