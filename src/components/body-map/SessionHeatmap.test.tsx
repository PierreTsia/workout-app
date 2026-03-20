import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { SessionHeatmap } from "./SessionHeatmap"
import type { IExerciseData } from "react-body-highlighter"

vi.mock("react-body-highlighter", () => ({
  default: ({ type }: { type: string }) => (
    <div data-testid={`body-model-${type}`} />
  ),
  MuscleType: {},
  ModelType: { ANTERIOR: "anterior", POSTERIOR: "posterior" },
}))

const SAMPLE_DATA: IExerciseData[] = [
  { name: "Bench Press", muscles: ["chest"], frequency: 4 },
  { name: "OHP", muscles: ["front-deltoids", "back-deltoids"], frequency: 2 },
]

describe("SessionHeatmap", () => {
  it("renders nothing when data is empty", () => {
    const { container } = renderWithProviders(
      <SessionHeatmap data={[]} />,
    )

    expect(container.innerHTML).toBe("")
  })

  it("renders the trigger label", () => {
    renderWithProviders(
      <SessionHeatmap data={SAMPLE_DATA} />,
    )

    expect(screen.getByText("Muscle map")).toBeInTheDocument()
  })

  it("is collapsed by default", () => {
    renderWithProviders(
      <SessionHeatmap data={SAMPLE_DATA} />,
    )

    expect(screen.queryByTestId("body-model-anterior")).not.toBeInTheDocument()
  })

  it("expands when defaultOpen is true", () => {
    renderWithProviders(
      <SessionHeatmap data={SAMPLE_DATA} defaultOpen />,
    )

    expect(screen.getByTestId("body-model-anterior")).toBeInTheDocument()
    expect(screen.getByTestId("body-model-posterior")).toBeInTheDocument()
  })

  it("toggles body map visibility on click", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <SessionHeatmap data={SAMPLE_DATA} />,
    )

    expect(screen.queryByTestId("body-model-anterior")).not.toBeInTheDocument()

    await user.click(screen.getByText("Muscle map"))

    expect(screen.getByTestId("body-model-anterior")).toBeInTheDocument()
  })
})
