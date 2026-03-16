import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ConstraintStep } from "./ConstraintStep"
import type { GeneratorConstraints } from "@/types/generator"

vi.mock("@/hooks/useExerciseFilterOptions", () => ({
  useExerciseFilterOptions: () => ({
    data: {
      muscle_groups: ["Pectoraux", "Dos", "Biceps"],
      equipment: [],
      difficulty_levels: [],
    },
    isLoading: false,
  }),
}))

function setup(overrides: Partial<GeneratorConstraints> = {}) {
  const constraints: GeneratorConstraints = {
    duration: 30,
    equipmentCategory: "full-gym",
    muscleGroups: ["full-body"],
    ...overrides,
  }
  const onChange = vi.fn()
  const onGenerate = vi.fn()
  const result = renderWithProviders(
    <ConstraintStep
      constraints={constraints}
      onChange={onChange}
      onGenerate={onGenerate}
      isLoading={false}
    />,
  )
  return { ...result, onChange, onGenerate }
}

describe("ConstraintStep", () => {
  it("renders all duration pills", () => {
    setup()
    expect(screen.getByText("15 min")).toBeInTheDocument()
    expect(screen.getByText("30 min")).toBeInTheDocument()
    expect(screen.getByText("45 min")).toBeInTheDocument()
    expect(screen.getByText("60 min")).toBeInTheDocument()
    expect(screen.getByText("90 min")).toBeInTheDocument()
  })

  it("renders equipment category pills", () => {
    setup()
    expect(screen.getByText("Bodyweight")).toBeInTheDocument()
    expect(screen.getByText("Dumbbells")).toBeInTheDocument()
    expect(screen.getByText("Full Gym")).toBeInTheDocument()
  })

  it("renders muscle group pills from hook data", () => {
    setup()
    expect(screen.getByText("Pectoraux")).toBeInTheDocument()
    expect(screen.getByText("Dos")).toBeInTheDocument()
    expect(screen.getByText("Biceps")).toBeInTheDocument()
  })

  it("calls onChange with new duration on pill click", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.click(screen.getByText("45 min"))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 45 }),
    )
  })

  it("calls onChange with new equipment on pill click", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.click(screen.getByText("Dumbbells"))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentCategory: "dumbbells" }),
    )
  })

  it("selects a specific muscle group and deselects full-body", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ muscleGroups: ["full-body"] })
    await user.click(screen.getByText("Pectoraux"))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ muscleGroups: ["Pectoraux"] }),
    )
  })

  it("falls back to full-body when last muscle group is deselected", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ muscleGroups: ["Pectoraux"] })
    await user.click(screen.getByText("Pectoraux"))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ muscleGroups: ["full-body"] }),
    )
  })

  it("allows multiple muscle groups", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ muscleGroups: ["Pectoraux"] })
    await user.click(screen.getByText("Biceps"))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ muscleGroups: ["Pectoraux", "Biceps"] }),
    )
  })

  it("clicking full-body resets to full-body only", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ muscleGroups: ["Pectoraux", "Biceps"] })
    await user.click(screen.getByText("Full Body"))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ muscleGroups: ["full-body"] }),
    )
  })

  it("calls onGenerate when Generate button is clicked", async () => {
    const user = userEvent.setup()
    const { onGenerate } = setup()
    await user.click(screen.getByRole("button", { name: /generate/i }))
    expect(onGenerate).toHaveBeenCalledOnce()
  })

  it("shows loading text when isLoading is true", () => {
    const onChange = vi.fn()
    const onGenerate = vi.fn()
    renderWithProviders(
      <ConstraintStep
        constraints={{
          duration: 30,
          equipmentCategory: "full-gym",
          muscleGroups: ["full-body"],
        }}
        onChange={onChange}
        onGenerate={onGenerate}
        isLoading={true}
      />,
    )
    expect(screen.getByText("Generating…")).toBeInTheDocument()
  })
})
