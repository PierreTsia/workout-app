import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { WorkoutExercise } from "@/types/database"
import { ExerciseRow } from "./ExerciseRow"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

function makeExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
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
    template_updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("ExerciseRow", () => {
  it("displays the rest time", () => {
    renderWithProviders(
      <ExerciseRow
        exercise={makeExercise({ rest_seconds: 90 })}
        onTap={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText(/90s/)).toBeInTheDocument()
  })
})
