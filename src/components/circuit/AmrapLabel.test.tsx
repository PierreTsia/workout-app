import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"

describe("AmrapLabel", () => {
  it("always pairs AMRAP with minutes and the gloss", () => {
    const { container } = renderWithProviders(<AmrapLabel minutes={20} />)

    expect(screen.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(
      screen.getByText("As many rounds as possible."),
    ).toBeInTheDocument()
    expect(container).toMatchSnapshot()
  })
})
