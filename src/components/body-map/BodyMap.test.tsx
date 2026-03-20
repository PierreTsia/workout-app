import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { BodyMap } from "./BodyMap"
import type { IExerciseData } from "react-body-highlighter"

vi.mock("react-body-highlighter", () => ({
  default: ({ type, data }: { type: string; data?: IExerciseData[] }) => (
    <div data-testid={`body-model-${type}`} data-muscles={data?.length ?? 0} />
  ),
  MuscleType: {},
  ModelType: { ANTERIOR: "anterior", POSTERIOR: "posterior" },
}))

describe("BodyMap", () => {
  it("renders anterior and posterior models", () => {
    renderWithProviders(
      <BodyMap muscleGroup="Pectoraux" />,
    )

    expect(screen.getByTestId("body-model-anterior")).toBeInTheDocument()
    expect(screen.getByTestId("body-model-posterior")).toBeInTheDocument()
  })

  it("passes mapped data for a single exercise with secondaries", () => {
    renderWithProviders(
      <BodyMap
        muscleGroup="Pectoraux"
        secondaryMuscles={["Triceps", "Épaules"]}
      />,
    )

    const anterior = screen.getByTestId("body-model-anterior")
    expect(anterior.dataset.muscles).toBe("3")
  })

  it("renders blank avatar when muscle group is unmapped", () => {
    renderWithProviders(
      <BodyMap muscleGroup="Unknown" />,
    )

    const anterior = screen.getByTestId("body-model-anterior")
    expect(anterior.dataset.muscles).toBe("0")
  })

  it("renders blank avatar when no props are provided", () => {
    renderWithProviders(<BodyMap />)

    const anterior = screen.getByTestId("body-model-anterior")
    expect(anterior.dataset.muscles).toBe("0")
  })

  it("prefers pre-built data over muscleGroup prop", () => {
    const data: IExerciseData[] = [
      { name: "Bench Press", muscles: ["chest"], frequency: 4 },
      { name: "OHP", muscles: ["front-deltoids"], frequency: 2 },
    ]

    renderWithProviders(
      <BodyMap data={data} muscleGroup="Abdos" />,
    )

    const anterior = screen.getByTestId("body-model-anterior")
    expect(anterior.dataset.muscles).toBe("2")
  })

  it("handles null secondary muscles gracefully", () => {
    renderWithProviders(
      <BodyMap muscleGroup="Biceps" secondaryMuscles={null} />,
    )

    const anterior = screen.getByTestId("body-model-anterior")
    expect(anterior.dataset.muscles).toBe("1")
  })
})
