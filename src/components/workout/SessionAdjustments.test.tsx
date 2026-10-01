import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import {
  SessionAdjustments,
  type DebriefAdjustment,
} from "./SessionAdjustments"

function makeAdjustment(
  overrides: Partial<DebriefAdjustment> = {},
): DebriefAdjustment {
  return {
    id: "dev-1",
    exerciseNameSnapshot: "Bench Press",
    catalogExercise: null,
    setNumber: 2,
    prescribed: "80",
    actual: "72.5",
    unit: "kg",
    weightChanged: true,
    prescribedReps: "10",
    actualReps: "10",
    repsChanged: false,
    reasonCode: "fatigue",
    note: null,
    ...overrides,
  }
}

describe("SessionAdjustments", () => {
  it("shows the empty state when the session had no adjustment", () => {
    renderWithProviders(<SessionAdjustments adjustments={[]} />)

    expect(screen.getByText("Adjustments")).toBeInTheDocument()
    expect(
      screen.getByText("No adjustments — you followed the plan."),
    ).toBeInTheDocument()
  })

  it("lists one row per adjustment: exercise, prescribed → actual, reason", () => {
    renderWithProviders(
      <SessionAdjustments adjustments={[makeAdjustment()]} />,
    )

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Set 2 · 80 → 72.5 kg")).toBeInTheDocument()
    expect(screen.getByText("Fatigue")).toBeInTheDocument()
  })

  it("shows the note when present and 'No reason given' when skipped", () => {
    renderWithProviders(
      <SessionAdjustments
        adjustments={[makeAdjustment({ reasonCode: null, note: "mal dormi" })]}
      />,
    )

    expect(screen.getByText("No reason given")).toBeInTheDocument()
    expect(screen.getByText("mal dormi")).toBeInTheDocument()
  })

  it("renders a reps-only deviation without a weight line", () => {
    renderWithProviders(
      <SessionAdjustments
        adjustments={[
          makeAdjustment({
            weightChanged: false,
            repsChanged: true,
            prescribedReps: "10",
            actualReps: "8",
          }),
        ]}
      />,
    )

    expect(screen.getByText("Reps 10 → 8")).toBeInTheDocument()
    expect(screen.queryByText("Set 2 · 80 → 72.5 kg")).not.toBeInTheDocument()
  })
})
