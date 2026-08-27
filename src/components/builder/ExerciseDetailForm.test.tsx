import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise, WorkoutExerciseWithExercise } from "@/types/database"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const mutate = vi.fn()
vi.mock("@/hooks/useBuilderMutations", () => ({
  useUpdateExercise: () => ({ mutate }),
}))

vi.mock("@/hooks/useExerciseFromLibrary", () => ({
  useExerciseFromLibrary: () => ({ data: undefined, isLoading: false }),
}))

import { ExerciseDetailForm } from "./ExerciseDetailForm"

function makeLibExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "lib-1",
    name: "Plank",
    name_en: "Plank",
    muscle_group: "Core",
    emoji: "🧘",
    is_system: true,
    created_at: "1970-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "bodyweight",
    difficulty_level: "beginner",
    source: null,
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
    measurement_type: "reps",
    default_duration_seconds: null,
    ...overrides,
  }
}

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

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not re-edit the four inline slot fields", () => {
    renderForm()

    expect(screen.queryByRole("spinbutton", { name: "Sets" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Reps" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("spinbutton", { name: "Rest (seconds)" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Progression settings")).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Min reps" })).toBeInTheDocument()
  })

  it("writes leftover range fields without touching sets or rest", async () => {
    const user = userEvent.setup()
    renderForm(
      makeExercise({
        weight_increment: 2.5,
        max_weight_reached: true,
        set_range_min: 3,
      }),
    )

    const minSets = screen.getByRole("spinbutton", { name: "Min sets" })
    await user.clear(minSets)
    await user.type(minSets, "4")

    await waitFor(() => expect(mutate).toHaveBeenCalled())
    const payload = mutate.mock.calls.at(-1)?.[0]
    expect(payload).toMatchObject({
      id: "ex-1",
      dayId: "day-1",
      set_range_min: 4,
      weight_increment: 2.5,
      max_weight_reached: true,
    })
    expect(payload).not.toHaveProperty("sets")
    expect(payload).not.toHaveProperty("rest_seconds")
    expect(payload).not.toHaveProperty("reps")
    expect(payload).not.toHaveProperty("weight")
  })

  it("flushes a pending leftover edit on unmount", () => {
    const { unmount } = renderForm(makeExercise({ set_range_min: 3 }))

    fireEvent.change(screen.getByRole("spinbutton", { name: "Min sets" }), {
      target: { value: "4" },
    })
    expect(mutate).not.toHaveBeenCalled()

    unmount()

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      set_range_min: 4,
    })
  })

  it("explains weight maxed on tap without flipping the switch", async () => {
    const user = userEvent.setup()
    renderForm()

    const toggle = screen.getByRole("switch", { name: "Weight maxed" })
    expect(toggle).toBeChecked()

    await user.click(
      screen.getByRole("button", { name: "What weight maxed means" }),
    )
    expect(
      await screen.findByText(
        "On when you can't go heavier. Next step is an extra set, not more weight.",
      ),
    ).toBeVisible()
    expect(toggle).toBeChecked()
  })

  it("shows duration ranges instead of rep ranges for holds", () => {
    renderWithProviders(
      <ExerciseDetailForm
        exercise={makeExercise()}
        libExercise={makeLibExercise({ measurement_type: "duration" })}
        onMutationStateChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("spinbutton", { name: "Min hold (sec)" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("spinbutton", { name: "Min reps" }),
    ).not.toBeInTheDocument()
  })
})
