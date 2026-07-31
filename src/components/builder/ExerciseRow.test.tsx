import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { Exercise, WorkoutExerciseWithExercise } from "@/types/database"
import { ExerciseRow } from "./ExerciseRow"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const catalogRow = (overrides: Partial<Exercise> = {}) =>
  ({
    id: "lib-1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    emoji: "💪",
    ...overrides,
  }) as Exercise

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
    template_updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function render(
  exercise: WorkoutExerciseWithExercise,
  locale?: "en" | "fr",
) {
  renderWithProviders(
    <ExerciseRow exercise={exercise} onTap={vi.fn()} onDelete={vi.fn()} />,
    { locale },
  )
}

describe("ExerciseRow", () => {
  it("displays the rest time", () => {
    render(makeExercise({ rest_seconds: 90 }))

    expect(screen.getByText(/90s/)).toBeInTheDocument()
  })

  it("shows the English catalog name to an English reader", () => {
    render(
      makeExercise({ name_snapshot: "Développé couché", exercise: catalogRow() }),
      "en",
    )

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("shows the French catalog name to a French reader", () => {
    render(
      makeExercise({ name_snapshot: "Développé couché", exercise: catalogRow() }),
      "fr",
    )

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  it("falls back to the catalog name in both locales when name_en is missing", () => {
    const exercise = makeExercise({
      name_snapshot: "Gainage latéral",
      exercise: catalogRow({ name: "Gainage latéral", name_en: null }),
    })

    render(exercise, "en")
    expect(screen.getByText("Gainage latéral")).toBeInTheDocument()
  })

  it("falls back to the snapshot when the catalog row is absent", () => {
    render(makeExercise({ name_snapshot: "Exercice supprimé" }), "en")

    expect(screen.getByText("Exercice supprimé")).toBeInTheDocument()
  })
})
