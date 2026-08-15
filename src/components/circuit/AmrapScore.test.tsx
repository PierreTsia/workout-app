import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { AmrapScore } from "@/components/circuit/AmrapScore"

describe("AmrapScore", () => {
  it("renders the hero score with a named leftover gloss", () => {
    renderWithProviders(
      <AmrapScore fullRounds={27} leftover={3} leftoverName="push-ups" />,
    )

    expect(screen.getByText("27+3")).toBeInTheDocument()
    expect(screen.getByText("27 rounds · 3 push-ups")).toBeInTheDocument()
  })

  it("renders a compact score that does not use the hero type size", () => {
    renderWithProviders(
      <AmrapScore
        size="compact"
        fullRounds={17}
        leftover={10}
        leftoverName="kneeling cable crunch"
      />,
    )

    const numeral = screen.getByText("17+10")
    expect(numeral.className).not.toMatch(/text-4xl/)
    expect(numeral.className).toMatch(/text-sm/)
    expect(
      screen.getByText("17 rounds · 10 kneeling cable crunch"),
    ).toBeInTheDocument()
  })
})
