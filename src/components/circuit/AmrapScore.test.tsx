import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { AmrapScore } from "@/components/circuit/AmrapScore"

describe("AmrapScore", () => {
  it("renders the hero score with a named leftover gloss", () => {
    const { container } = renderWithProviders(
      <AmrapScore fullRounds={27} leftover={3} leftoverName="push-ups" />,
    )

    expect(screen.getByText("27+3")).toBeInTheDocument()
    expect(screen.getByText("27 rounds · 3 push-ups")).toBeInTheDocument()
    expect(container).toMatchSnapshot()
  })
})
