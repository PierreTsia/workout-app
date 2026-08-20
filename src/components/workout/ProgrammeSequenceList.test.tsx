import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"
import { ProgrammeSequenceList } from "./ProgrammeSequenceList"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

function makeBlockExercise(
  over: Partial<BlockExerciseWithExercise> & Pick<BlockExerciseWithExercise, "id" | "block_id">,
): BlockExerciseWithExercise {
  return {
    exercise_id: `ex-${over.id}`,
    name_snapshot: "Station",
    muscle_snapshot: "chest",
    emoji_snapshot: "💪",
    position: 0,
    per_round: [{ amount: 10, weight: 50 }],
    exercise: null,
    ...over,
  }
}

function makeBlock(
  over: Partial<ExerciseBlockWithExercises> & Pick<ExerciseBlockWithExercises, "id" | "label">,
): ExerciseBlockWithExercises {
  return {
    workout_day_id: "day-1",
    rounds: 1,
    rest_seconds: 0,
    transition_seconds: 0,
    mode: "amrap",
    cap_seconds: 10 * 60,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    exercises: [
      makeBlockExercise({
        id: `${over.id}-be`,
        block_id: over.id,
        name_snapshot: "Push-ups",
        per_round: [{ amount: 10, weight: 20 }],
      }),
    ],
    ...over,
  }
}

describe("ProgrammeSequenceList", () => {
  it("renders four AMRAP circuit cards and never shows kg", () => {
    const blocks = [
      makeBlock({ id: "b-1", label: "Theseus", sort_order: 0 }),
      makeBlock({ id: "b-2", label: "Zeus", sort_order: 1 }),
      makeBlock({ id: "b-3", label: "Heracles", sort_order: 2 }),
      makeBlock({ id: "b-4", label: "Ares", sort_order: 3 }),
    ]

    renderWithProviders(
      <ProgrammeSequenceList exercises={[]} blocks={blocks} />,
    )

    expect(screen.getByText("Theseus")).toBeInTheDocument()
    expect(screen.getByText("Zeus")).toBeInTheDocument()
    expect(screen.getByText("Heracles")).toBeInTheDocument()
    expect(screen.getByText("Ares")).toBeInTheDocument()
    expect(screen.getAllByText("AMRAP 10 min")).toHaveLength(4)
    expect(screen.queryByText(/kg/i)).not.toBeInTheDocument()
    expect(screen.queryByText("20")).not.toBeInTheDocument()
  })

  it("shows a solo as sets × reps and omits the template weight", () => {
    const squat: WorkoutExerciseWithLabel = {
      id: "solo-1",
      workout_day_id: "day-1",
      exercise_id: "ex-squat",
      name_snapshot: "Squat",
      muscle_snapshot: "legs",
      emoji_snapshot: "🦵",
      sets: 4,
      reps: "8",
      weight: "50",
      rest_seconds: 90,
      sort_order: 0,
      template_updated_at: "1970-01-01T00:00:00Z",
      exercise: {
        id: "ex-squat",
        name: "Squat",
        name_en: "Squat",
        muscle_group: "Jambes",
        equipment: "barbell",
        emoji: "🦵",
      },
    }

    renderWithProviders(
      <ProgrammeSequenceList exercises={[squat]} blocks={[]} />,
    )

    expect(screen.getByText("Squat")).toBeInTheDocument()
    expect(screen.getByText("4 × 8")).toBeInTheDocument()
    expect(screen.queryByText("50")).not.toBeInTheDocument()
    expect(screen.queryByText(/kg/i)).not.toBeInTheDocument()
  })
})
