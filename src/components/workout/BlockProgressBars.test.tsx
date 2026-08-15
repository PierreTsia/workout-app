import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BlockProgressBars } from "@/components/workout/BlockProgressBars"

describe("BlockProgressBars", () => {
  it("shows Tour N without a denominator when roundTotal is omitted", () => {
    renderWithProviders(
      <BlockProgressBars
        roundCurrent={4}
        exerciseCurrent={2}
        exerciseTotal={3}
      />,
    )

    expect(screen.getByTestId("block-round-count")).toHaveTextContent("4")
    expect(screen.getByTestId("block-round-count")).not.toHaveTextContent("/")
    expect(screen.getByTestId("block-exercise-count")).toHaveTextContent("2/3")
  })
})
