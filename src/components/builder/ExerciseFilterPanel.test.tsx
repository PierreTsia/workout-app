import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ExerciseFilterPanel } from "./ExerciseFilterPanel"

const MUSCLE_GROUPS = ["Abdos", "Biceps", "Dos", "Pectoraux"]
const EQUIPMENT = ["barbell", "bodyweight", "dumbbell", "machine"]

function renderPanel(overrides = {}) {
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
  const result = renderWithProviders(<ExerciseFilterPanel {...defaultProps} />)
  return { ...result, ...defaultProps }
}

describe("ExerciseFilterPanel", () => {
  it("renders muscle group pills", () => {
    renderPanel()
    for (const group of MUSCLE_GROUPS) {
      expect(screen.getByRole("button", { name: group })).toBeInTheDocument()
    }
  })

  it("renders equipment pills with translated labels", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: "Barbell" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dumbbell" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Machine" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bodyweight" })).toBeInTheDocument()
  })

  it("calls onMuscleGroupChange when a muscle group is clicked", async () => {
    const { onMuscleGroupChange } = renderPanel()
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Pectoraux" }))
    expect(onMuscleGroupChange).toHaveBeenCalledWith("Pectoraux")
  })

  it("deselects muscle group when the active one is clicked again", async () => {
    const { onMuscleGroupChange } = renderPanel({
      selectedMuscleGroup: "Pectoraux",
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Pectoraux" }))
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
    const btn = screen.getByRole("button", { name: "Dos" })
    expect(btn.className).toContain("bg-primary")
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
