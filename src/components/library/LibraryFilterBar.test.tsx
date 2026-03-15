import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { LibraryFilterBar } from "./LibraryFilterBar"

function renderFilter(overrides = {}) {
  const defaultProps = {
    selectedGoal: null as string | null,
    selectedExperience: null as string | null,
    selectedEquipment: null as string | null,
    onGoalChange: vi.fn(),
    onExperienceChange: vi.fn(),
    onEquipmentChange: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<LibraryFilterBar {...defaultProps} />)
  return defaultProps
}

describe("LibraryFilterBar", () => {
  it("renders all goal pills", () => {
    renderFilter()
    expect(screen.getByRole("button", { name: "Strength" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hypertrophy" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Endurance" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "General fitness" })).toBeInTheDocument()
  })

  it("renders all experience pills", () => {
    renderFilter()
    expect(screen.getByRole("button", { name: "Beginner" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Intermediate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument()
  })

  it("renders all equipment pills", () => {
    renderFilter()
    expect(screen.getByRole("button", { name: "Gym" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Minimal" })).toBeInTheDocument()
  })

  it("calls onGoalChange when a goal pill is clicked", async () => {
    const props = renderFilter()
    await userEvent.setup().click(screen.getByRole("button", { name: "Strength" }))
    expect(props.onGoalChange).toHaveBeenCalledWith("strength")
  })

  it("calls onGoalChange(null) when the selected goal is clicked again", async () => {
    const props = renderFilter({ selectedGoal: "strength" })
    await userEvent.setup().click(screen.getByRole("button", { name: "Strength" }))
    expect(props.onGoalChange).toHaveBeenCalledWith(null)
  })

  it("does not show 'Clear filters' when no filter is active", () => {
    renderFilter()
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument()
  })

  it("shows 'Clear filters' when a filter is active", () => {
    renderFilter({ selectedGoal: "strength" })
    expect(screen.getByText("Clear filters")).toBeInTheDocument()
  })

  it("clears all filters when 'Clear filters' is clicked", async () => {
    const props = renderFilter({ selectedGoal: "strength", selectedEquipment: "gym" })
    await userEvent.setup().click(screen.getByText("Clear filters"))
    expect(props.onGoalChange).toHaveBeenCalledWith(null)
    expect(props.onExperienceChange).toHaveBeenCalledWith(null)
    expect(props.onEquipmentChange).toHaveBeenCalledWith(null)
  })
})
