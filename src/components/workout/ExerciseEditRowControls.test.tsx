import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ExerciseEditRowControls } from "./ExerciseEditRowControls"
import type {
  ExerciseListItem,
  WorkoutExercise,
} from "@/types/database"
import type { ProgressionSuggestion } from "@/lib/progression"

function makeExercise(
  overrides: Partial<WorkoutExercise> = {},
): WorkoutExercise {
  return {
    id: "we-1",
    workout_day_id: "day-1",
    exercise_id: "ex-1",
    name_snapshot: "Bench Press",
    muscle_snapshot: "chest",
    emoji_snapshot: "🏋️",
    sets: 3,
    reps: "10",
    weight: "80",
    rest_seconds: 90,
    sort_order: 0,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    ...overrides,
  }
}

const baseProps = {
  exercisePool: [] as ExerciseListItem[],
  poolLoading: false,
  currentExerciseIds: ["ex-1"],
  onSwapExerciseChosen: vi.fn(),
  onDeleteRequested: vi.fn(),
  onSwapBrowseLibrary: vi.fn(),
  onInspectDetails: vi.fn(),
}

describe("ExerciseEditRowControls — pre-session progression", () => {
  it("shows a skeleton in place of the weight while the suggestion is loading", () => {
    renderWithProviders(
      <ExerciseEditRowControls
        {...baseProps}
        exercise={makeExercise()}
        suggestion={undefined}
        isLoadingSuggestion
      />,
    )

    expect(screen.getByTestId("progression-suggestion-skeleton")).toBeTruthy()
    expect(screen.queryByText(/80\s*kg/i)).toBeNull()
  })

  it("uses the suggested weight (not the template) and shows a compact pill on WEIGHT_UP", () => {
    const suggestion: ProgressionSuggestion = {
      rule: "WEIGHT_UP",
      reps: 8,
      weight: 57,
      sets: 3,
      delta: "2.5",
      reasonKey: "progression.weightUp",
      volumeType: "reps",
    }

    renderWithProviders(
      <ExerciseEditRowControls
        {...baseProps}
        exercise={makeExercise({ weight: "48", reps: "8", sets: 3 })}
        suggestion={suggestion}
      />,
    )

    expect(screen.getByText(/3 × 8 · 57\s*kg/i)).toBeTruthy()
    expect(screen.queryByText(/48\s*kg/i)).toBeNull()
    expect(screen.getByLabelText(/Weight up/i)).toBeTruthy()
  })

  it("falls back to template values with no pill when suggestion is null (no Last Performance)", () => {
    renderWithProviders(
      <ExerciseEditRowControls
        {...baseProps}
        exercise={makeExercise({ weight: "60", reps: "10", sets: 3 })}
        suggestion={null}
      />,
    )

    expect(screen.getByText(/3 × 10 · 60\s*kg/i)).toBeTruthy()
    expect(screen.queryByLabelText(/up|hold|plateau/i)).toBeNull()
  })

  it("renders the pill on HOLD_NEAR_FAILURE while keeping the unchanged values", () => {
    const suggestion: ProgressionSuggestion = {
      rule: "HOLD_NEAR_FAILURE",
      reps: 10,
      weight: 80,
      sets: 3,
      delta: "—",
      reasonKey: "progression.holdNearFailure",
      volumeType: "reps",
    }

    renderWithProviders(
      <ExerciseEditRowControls
        {...baseProps}
        exercise={makeExercise({ weight: "80", reps: "10", sets: 3 })}
        suggestion={suggestion}
      />,
    )

    expect(screen.getByText(/3 × 10 · 80\s*kg/i)).toBeTruthy()
    expect(screen.getByLabelText(/Hold.*near failure/i)).toBeTruthy()
  })
})
