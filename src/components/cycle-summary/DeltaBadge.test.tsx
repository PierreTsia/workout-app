import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { DeltaBadge } from "./DeltaBadge"

describe("DeltaBadge", () => {
  it("renders nothing for null value", () => {
    const { container } = renderWithProviders(<DeltaBadge value={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for undefined value", () => {
    const { container } = renderWithProviders(<DeltaBadge value={undefined} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for zero", () => {
    const { container } = renderWithProviders(<DeltaBadge value={0} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders positive delta with green styling and plus sign", () => {
    renderWithProviders(<DeltaBadge value={12.5} />)
    const badge = screen.getByText((_content, element) =>
      element?.textContent === "+12.5%" && element?.tagName === "SPAN",
    )
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("text-emerald-400")
  })

  it("renders negative delta with red styling", () => {
    renderWithProviders(<DeltaBadge value={-8.3} />)
    const badge = screen.getByText((_content, element) =>
      element?.textContent === "-8.3%" && element?.tagName === "SPAN",
    )
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("text-red-400")
  })
})
