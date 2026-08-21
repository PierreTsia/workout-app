import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BALANCE_BAND_COLOR } from "@/lib/trainingBalance"
import { BalanceScoreBar } from "./BalanceScoreBar"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("BalanceScoreBar", () => {
  it("fills a progressbar with the attention band color at 67", () => {
    renderWithProviders(
      <BalanceScoreBar score={67} label="67 / 100" bandLabel="Needs attention" />,
    )

    const bar = screen.getByRole("progressbar", { name: "67 / 100" })
    expect(bar).toHaveAttribute("aria-valuenow", "67")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
    expect(screen.getByText("Needs attention")).toBeInTheDocument()

    const fill = bar.firstElementChild
    expect(fill).toHaveStyle({
      backgroundColor: BALANCE_BAND_COLOR.attention,
      transform: "scaleX(0.67)",
    })
  })
})
