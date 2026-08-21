import { describe, expect, it, vi } from "vitest"
import { screen, within } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { RegularsBlock } from "./RegularsBlock"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("RegularsBlock", () => {
  it("shows name and last evolution, not program pills", () => {
    renderWithProviders(<RegularsBlock mode="pierre" />)

    expect(screen.getByText("Squat")).toBeInTheDocument()
    expect(screen.getAllByText("+2 kg").length).toBeGreaterThan(0)
    expect(screen.queryByText("On program")).not.toBeInTheDocument()
    expect(screen.queryByText("Off program")).not.toBeInTheDocument()
  })

  it("shows empty copy when there are not enough 100d logs", () => {
    renderWithProviders(<RegularsBlock mode="empty" />)

    expect(screen.getByText("Not enough logs in 100 days.")).toBeInTheDocument()
    expect(screen.queryByText("Squat")).not.toBeInTheDocument()
    expect(screen.queryByText("+2 kg")).not.toBeInTheDocument()
  })

  it("ranks by 100d rep count with Pull-up on top", () => {
    renderWithProviders(<RegularsBlock mode="pierre" />)

    const heading = screen.getByRole("heading", { name: "Regulars" })
    const card = heading.parentElement?.parentElement
    if (!card) throw new Error("expected Regulars card")
    const items = within(card).getAllByRole("listitem")
    expect(items).toHaveLength(8)
    expect(within(items[0]).getByText("Pull-up")).toBeInTheDocument()
    expect(within(items[0]).getByText("400")).toBeInTheDocument()
    expect(within(items[items.length - 1]).getByText("Walking lunge")).toBeInTheDocument()
  })
})
