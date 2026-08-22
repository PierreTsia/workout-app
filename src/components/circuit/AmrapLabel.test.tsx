import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"

describe("AmrapLabel", () => {
  it("always pairs AMRAP with minutes and the gloss on one line", () => {
    renderWithProviders(<AmrapLabel minutes={20} />)

    expect(screen.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(
      screen.getByText(/as many rounds as possible/i),
    ).toBeInTheDocument()
  })

  it("inline variant shows the cap only and keeps the gloss on the accessible name", () => {
    renderWithProviders(<AmrapLabel minutes={10} variant="inline" />)

    expect(screen.getByText("AMRAP 10 min")).toBeInTheDocument()
    expect(
      screen.queryByText(/as many rounds as possible/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByLabelText(/AMRAP 10 min.*as many rounds as possible/i),
    ).toBeInTheDocument()
  })

  it("badge variant keeps AMRAP and minutes on one line, gloss in the tooltip", () => {
    renderWithProviders(<AmrapLabel minutes={10} variant="badge" />)

    expect(screen.getByText("AMRAP")).toBeInTheDocument()
    expect(screen.getByText("10 min")).toBeInTheDocument()
    expect(screen.queryByText("AMRAP 10 min")).not.toBeInTheDocument()
    expect(
      screen.queryByText(/as many rounds as possible/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByLabelText(/AMRAP 10 min.*as many rounds as possible/i),
    ).toBeInTheDocument()
    expect(screen.getByText("10 min").className).toMatch(/truncate/)
  })
})
