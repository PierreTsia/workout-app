import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ExerciseAddPicker } from "./ExerciseAddPicker"
import type { Exercise } from "@/types/database"

function fakeExercise(overrides: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: overrides.id,
    muscle_group: "Pectoraux",
    emoji: "💪",
    is_system: true,
    created_at: "",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: null,
    name_en: null,
    source: null,
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  }
}

const POOL: Exercise[] = [
  fakeExercise({ id: "bench", name: "Bench Press", muscle_group: "Pectoraux" }),
  fakeExercise({ id: "fly", name: "Pec Fly", muscle_group: "Pectoraux" }),
  fakeExercise({ id: "curl", name: "Bicep Curl", muscle_group: "Biceps" }),
  fakeExercise({ id: "row", name: "Barbell Row", muscle_group: "Dos" }),
]

function setup(currentExerciseIds: string[] = []) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const result = renderWithProviders(
    <ExerciseAddPicker
      pool={POOL}
      currentExerciseIds={currentExerciseIds}
      onSelect={onSelect}
      onClose={onClose}
    />,
  )
  return { ...result, onSelect, onClose }
}

describe("ExerciseAddPicker", () => {
  it("renders all exercises not already selected", () => {
    setup(["bench"])
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
    expect(screen.getByText("Pec Fly")).toBeInTheDocument()
    expect(screen.getByText("Bicep Curl")).toBeInTheDocument()
    expect(screen.getByText("Barbell Row")).toBeInTheDocument()
  })

  it("groups exercises by muscle group", () => {
    setup()
    expect(screen.getByText("Pectoraux")).toBeInTheDocument()
    expect(screen.getByText("Biceps")).toBeInTheDocument()
    expect(screen.getByText("Dos")).toBeInTheDocument()
  })

  it("filters exercises by search term", async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByPlaceholderText("Search…"), "curl")
    expect(screen.getByText("Bicep Curl")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
    expect(screen.queryByText("Pec Fly")).not.toBeInTheDocument()
  })

  it("matches exercises ignoring diacritics", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(
      <ExerciseAddPicker
        pool={[
          fakeExercise({ id: "dev", name: "Développé couché", muscle_group: "Pectoraux" }),
          fakeExercise({ id: "curl", name: "Bicep Curl", muscle_group: "Biceps" }),
        ]}
        currentExerciseIds={[]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    await user.type(screen.getByPlaceholderText("Search…"), "developpe")
    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bicep Curl")).not.toBeInTheDocument()
  })

  it("shows empty state when search matches nothing", async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByPlaceholderText("Search…"), "zzzzz")
    expect(
      screen.getByText("No alternative exercises available"),
    ).toBeInTheDocument()
  })

  it("calls onSelect when an exercise is clicked", async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()
    await user.click(screen.getByText("Bicep Curl"))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "curl", name: "Bicep Curl" }),
    )
  })

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.click(screen.getByText("Cancel"))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("shows empty state when all exercises are already selected", () => {
    setup(["bench", "fly", "curl", "row"])
    expect(
      screen.getByText("No alternative exercises available"),
    ).toBeInTheDocument()
  })
})
