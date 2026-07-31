import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ExerciseFilterPanel } from "./ExerciseFilterPanel"

/** Canonical values, as the filter options RPC returns them. */
const MUSCLE_GROUPS = ["Abdos", "Biceps", "Dos", "Pectoraux"]
const EQUIPMENT = ["barbell", "bodyweight", "dumbbell", "machine"]

function renderPanel(overrides = {}, locale: "en" | "fr" = "en") {
  const defaultProps = {
    muscleGroups: MUSCLE_GROUPS,
    equipmentTypes: EQUIPMENT,
    difficultyLevels: [] as string[],
    selectedMuscleGroup: null as string | null,
    selectedEquipment: [] as string[],
    selectedDifficulty: [] as string[],
    onMuscleGroupChange: vi.fn(),
    onEquipmentChange: vi.fn(),
    onDifficultyChange: vi.fn(),
    ...overrides,
  }
  const result = renderWithProviders(<ExerciseFilterPanel {...defaultProps} />, {
    locale,
  })
  return { ...result, ...defaultProps }
}

describe("ExerciseFilterPanel", () => {
  it("renders muscle group pills with translated labels", () => {
    renderPanel()
    for (const label of ["Abs", "Biceps", "Back", "Chest"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("labels muscle pills in French for a French reader", () => {
    renderPanel({}, "fr")
    for (const label of MUSCLE_GROUPS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("renders equipment pills with translated labels", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: "Barbell" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dumbbell" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Machine" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bodyweight" })).toBeInTheDocument()
  })

  // The point of the ticket: the label is translated, the value sent back to
  // the query never is.
  it("filters on the canonical value behind a translated pill", async () => {
    const { onMuscleGroupChange } = renderPanel()
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Chest" }))
    expect(onMuscleGroupChange).toHaveBeenCalledWith("Pectoraux")
  })

  it("deselects muscle group when the active one is clicked again", async () => {
    const { onMuscleGroupChange } = renderPanel({
      selectedMuscleGroup: "Pectoraux",
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Chest" }))
    expect(onMuscleGroupChange).toHaveBeenCalledWith(null)
  })

  it("calls onEquipmentChange when an equipment pill is clicked", async () => {
    const { onEquipmentChange } = renderPanel()
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Barbell" }))
    expect(onEquipmentChange).toHaveBeenCalledWith(["barbell"])
  })

  it("supports multi-select for equipment", async () => {
    const { onEquipmentChange } = renderPanel({
      selectedEquipment: ["barbell"],
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Dumbbell" }))
    expect(onEquipmentChange).toHaveBeenCalledWith(["barbell", "dumbbell"])
  })

  it("removes equipment from selection when clicked again", async () => {
    const { onEquipmentChange } = renderPanel({
      selectedEquipment: ["barbell", "dumbbell"],
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Barbell" }))
    expect(onEquipmentChange).toHaveBeenCalledWith(["dumbbell"])
  })

  it("applies active style to selected muscle group", () => {
    renderPanel({ selectedMuscleGroup: "Dos" })
    const btn = screen.getByRole("button", { name: "Back" })
    expect(btn.className).toContain("bg-primary")
  })

  it("renders a muscle value outside the taxonomy as-is", () => {
    renderPanel({ muscleGroups: ["Ischios / Bas du dos"] })
    expect(
      screen.getByRole("button", { name: "Ischios / Bas du dos" }),
    ).toBeInTheDocument()
  })

  it("applies active style to selected equipment", () => {
    renderPanel({ selectedEquipment: ["barbell"] })
    const btn = screen.getByRole("button", { name: "Barbell" })
    expect(btn.className).toContain("bg-primary")
  })

  it("renders difficulty section with label and pills when difficultyLevels provided", () => {
    renderPanel({
      difficultyLevels: ["beginner", "intermediate", "advanced"],
    })
    expect(screen.getByText("Difficulty")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Beginner" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Intermediate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument()
  })

  it("calls onDifficultyChange when a difficulty pill is clicked", async () => {
    const { onDifficultyChange } = renderPanel({
      difficultyLevels: ["beginner", "intermediate", "advanced"],
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Beginner" }))
    expect(onDifficultyChange).toHaveBeenCalledWith(["beginner"])
  })

  it("supports multi-select for difficulty", async () => {
    const { onDifficultyChange } = renderPanel({
      difficultyLevels: ["beginner", "intermediate", "advanced"],
      selectedDifficulty: ["beginner"],
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Intermediate" }))
    expect(onDifficultyChange).toHaveBeenCalledWith(["beginner", "intermediate"])
  })

  it("applies active style to selected difficulty", () => {
    renderPanel({
      difficultyLevels: ["beginner", "intermediate", "advanced"],
      selectedDifficulty: ["intermediate"],
    })
    const btn = screen.getByRole("button", { name: "Intermediate" })
    expect(btn.className).toContain("bg-primary")
  })
})
