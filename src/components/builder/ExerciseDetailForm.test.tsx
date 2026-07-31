import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { WorkoutExerciseWithExercise } from "@/types/database"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const mutate = vi.fn()
vi.mock("@/hooks/useBuilderMutations", () => ({
  useUpdateExercise: () => ({ mutate }),
}))

import { ExerciseDetailForm } from "./ExerciseDetailForm"

function makeExercise(
  overrides: Partial<WorkoutExerciseWithExercise> = {},
): WorkoutExerciseWithExercise {
  return {
    exercise: null,
    id: "ex-1",
    workout_day_id: "day-1",
    exercise_id: "lib-1",
    name_snapshot: "Bench Press",
    muscle_snapshot: "Chest",
    emoji_snapshot: "💪",
    sets: 4,
    reps: "8-12",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    target_duration_seconds: null,
    weight_increment: 2.5,
    max_weight_reached: true,
    template_updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function renderForm(exercise = makeExercise()) {
  return renderWithProviders(
    <ExerciseDetailForm
      exercise={exercise}
      libExercise={undefined}
      onMutationStateChange={vi.fn()}
    />,
  )
}

describe("ExerciseDetailForm", () => {
  beforeEach(() => {
    mutate.mockClear()
  })

  it("seeds the rest input with the exercise's existing rest_seconds", () => {
    renderForm(makeExercise({ rest_seconds: 120 }))

    expect(screen.getByRole("spinbutton", { name: "Rest (seconds)" })).toHaveValue(
      120,
    )
  })

  it("preserves weight_increment and max_weight_reached when only rest is edited", async () => {
    const user = userEvent.setup()
    renderForm(
      makeExercise({
        rest_seconds: 90,
        weight_increment: 2.5,
        max_weight_reached: true,
      }),
    )

    const rest = screen.getByRole("spinbutton", { name: "Rest (seconds)" })
    await user.clear(rest)
    await user.type(rest, "120")

    await waitFor(() => expect(mutate).toHaveBeenCalled())
    const payload = mutate.mock.calls.at(-1)![0]
    expect(payload.rest_seconds).toBe(120)
    expect(payload.weight_increment).toBe(2.5)
    expect(payload.max_weight_reached).toBe(true)
  })
})
