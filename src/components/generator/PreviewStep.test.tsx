import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { PreviewStep } from "./PreviewStep"
import type { Exercise } from "@/types/database"
import type { GeneratedExercise, GeneratedWorkout } from "@/types/generator"

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

function makeGeneratedExercise(
  overrides: Partial<GeneratedExercise> & { exercise: Exercise },
): GeneratedExercise {
  return {
    sets: 3,
    reps: "10",
    restSeconds: 90,
    isCompound: true,
    ...overrides,
  }
}

const EX_A = fakeExercise({ id: "a", name: "Exercise A" })
const EX_B = fakeExercise({ id: "b", name: "Exercise B" })
const EX_C = fakeExercise({ id: "c", name: "Exercise C" })

const BASE_WORKOUT: GeneratedWorkout = {
  exercises: [
    makeGeneratedExercise({ exercise: EX_A }),
    makeGeneratedExercise({ exercise: EX_B }),
  ],
  name: "Quick: Test Workout",
  fallbackNotice: null,
}

const POOL = [EX_A, EX_B, EX_C]

function setup(workoutOverrides: Partial<GeneratedWorkout> = {}) {
  const workout = { ...BASE_WORKOUT, ...workoutOverrides }
  const onStart = vi.fn()
  const onShuffle = vi.fn()
  const onBack = vi.fn()

  const result = renderWithProviders(
    <PreviewStep
      workout={workout}
      exercisePool={POOL}
      onStart={onStart}
      onShuffle={onShuffle}
      onBack={onBack}
      isStarting={false}
    />,
  )

  return { ...result, onStart, onShuffle, onBack }
}

describe("PreviewStep", () => {
  it("renders the workout name in an input", () => {
    setup()
    const input = screen.getByDisplayValue("Quick: Test Workout")
    expect(input).toBeInTheDocument()
  })

  it("renders all exercises", () => {
    setup()
    expect(screen.getByText("Exercise A")).toBeInTheDocument()
    expect(screen.getByText("Exercise B")).toBeInTheDocument()
  })

  it("shows the exercise count", () => {
    setup()
    expect(screen.getByText(/2/)).toBeInTheDocument()
    expect(screen.getByText(/exercises/)).toBeInTheDocument()
  })

  it("calls onShuffle when Shuffle button is clicked", async () => {
    const user = userEvent.setup()
    const { onShuffle } = setup()
    await user.click(screen.getByRole("button", { name: /shuffle/i }))
    expect(onShuffle).toHaveBeenCalledOnce()
  })

  it("calls onStart with current exercises when Start is clicked", async () => {
    const user = userEvent.setup()
    const { onStart } = setup()
    await user.click(screen.getByRole("button", { name: /start workout/i }))
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Quick: Test Workout",
        exercises: expect.arrayContaining([
          expect.objectContaining({ exercise: expect.objectContaining({ id: "a" }) }),
          expect.objectContaining({ exercise: expect.objectContaining({ id: "b" }) }),
        ]),
      }),
    )
  })

  it("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup()
    const { onBack } = setup()
    const buttons = screen.getAllByRole("button")
    const backBtn = buttons[0]
    await user.click(backBtn)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("shows fallback notice when present", () => {
    setup({ fallbackNotice: "Some bodyweight exercises were added" })
    expect(
      screen.getByText("Some bodyweight exercises were added"),
    ).toBeInTheDocument()
  })

  it("does not show fallback notice when null", () => {
    setup({ fallbackNotice: null })
    expect(
      screen.queryByText(/bodyweight exercises were added/),
    ).not.toBeInTheDocument()
  })

  it("shows the Add exercise button", () => {
    setup()
    expect(
      screen.getByRole("button", { name: /add exercise/i }),
    ).toBeInTheDocument()
  })

  it("disables Start button when no exercises", () => {
    setup({ exercises: [] })
    const startBtn = screen.getByRole("button", { name: /start workout/i })
    expect(startBtn).toBeDisabled()
  })
})
