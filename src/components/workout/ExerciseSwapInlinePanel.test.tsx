import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ExerciseSwapInlinePanel } from "./ExerciseSwapInlinePanel"
import type { Exercise, WorkoutExercise } from "@/types/database"

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

const ROW: WorkoutExercise = {
  id: "row-1",
  workout_day_id: "day-1",
  exercise_id: "bench",
  name_snapshot: "Bench",
  muscle_snapshot: "Pectoraux",
  emoji_snapshot: "🏋️",
  sets: 3,
  reps: "8",
  weight: "60",
  rest_seconds: 90,
  sort_order: 0,
  rep_range_min: 6,
  rep_range_max: 10,
  set_range_min: 2,
  set_range_max: 5,
  weight_increment: null,
  max_weight_reached: false,
}

const POOL: Exercise[] = [
  fakeExercise({ id: "bench", name: "Bench Press", muscle_group: "Pectoraux" }),
  fakeExercise({ id: "fly", name: "Pec Fly", muscle_group: "Pectoraux" }),
]

describe("ExerciseSwapInlinePanel", () => {
  it("calls onDismiss when Cancel is used on the All exercises tab", async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    renderWithProviders(
      <ExerciseSwapInlinePanel
        exercise={ROW}
        exercisePool={POOL}
        currentExerciseIds={["bench"]}
        onSwapExerciseChosen={vi.fn()}
        onSwapBrowseLibrary={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /all exercises/i }))
    await user.click(screen.getByRole("button", { name: /^cancel$/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it("calls onSwapBrowseLibrary from the All exercises tab", async () => {
    const user = userEvent.setup()
    const onSwapBrowseLibrary = vi.fn()
    renderWithProviders(
      <ExerciseSwapInlinePanel
        exercise={ROW}
        exercisePool={POOL}
        currentExerciseIds={["bench"]}
        onSwapExerciseChosen={vi.fn()}
        onSwapBrowseLibrary={onSwapBrowseLibrary}
        onDismiss={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /all exercises/i }))
    await user.click(screen.getByRole("button", { name: /browse full library/i }))
    expect(onSwapBrowseLibrary).toHaveBeenCalledWith(ROW)
  })

  it("calls onSwapExerciseChosen and onDismiss when a same-muscle candidate is picked", async () => {
    const user = userEvent.setup()
    const onSwapExerciseChosen = vi.fn()
    const onDismiss = vi.fn()
    renderWithProviders(
      <ExerciseSwapInlinePanel
        exercise={ROW}
        exercisePool={POOL}
        currentExerciseIds={["bench"]}
        onSwapExerciseChosen={onSwapExerciseChosen}
        onSwapBrowseLibrary={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole("button", { name: /pec fly/i }))
    expect(onSwapExerciseChosen).toHaveBeenCalledWith(
      ROW,
      expect.objectContaining({ id: "fly", name: "Pec Fly" }),
    )
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
