import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { ExerciseEditForm } from "./ExerciseEditForm"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))
vi.mock("@/hooks/useExerciseFilterOptions", () => ({
  useExerciseFilterOptions: () => ({
    data: {
      muscle_groups: ["Pectoraux", "Biceps"],
      equipment: ["barbell", "dumbbell"],
      difficulty_levels: [],
    },
  }),
}))

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: "bench",
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  emoji: "🏋️",
  is_system: true,
  created_at: "",
  youtube_url: null,
  instructions: {
    setup: ["Set up"],
    movement: ["Push"],
    breathing: ["Breathe"],
    common_mistakes: ["Flare"],
  },
  image_url: null,
  difficulty_level: null,
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  measurement_type: "reps",
  ...overrides,
})

function render(onSubmit = vi.fn()) {
  return renderWithProviders(
    <ExerciseEditForm
      exercise={exercise()}
      onSubmit={onSubmit}
      isPending={false}
    />,
    { locale: "en" },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ExerciseEditForm", () => {
  it("associates each field label with its control", () => {
    render()

    expect(screen.getByLabelText(/^Name\*?$/)).toHaveValue("Développé couché")
    expect(screen.getByLabelText(/^Name \(EN\)$/)).toHaveValue("Bench Press")
  })

  it("keeps the zod required-field validation on submit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(onSubmit)

    await user.clear(screen.getByLabelText(/^Name\*?$/))
    await user.click(screen.getByRole("button", { name: /save changes/i }))

    expect(await screen.findByText("Required")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("adds and removes instruction steps through the field array", async () => {
    const user = userEvent.setup()
    render()

    const setupLabel = screen.getByText("Setup")
    expect(setupLabel).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: /add step/i })[0])
    expect(screen.getByLabelText("Step 2")).toHaveValue("")

    await user.click(screen.getAllByRole("button", { name: /remove/i })[0])
    expect(screen.queryByLabelText("Step 2")).not.toBeInTheDocument()
  })
})
