import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlockSessionCard } from "./BlockSessionCard"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
} from "@/types/database"

const be = (id: string, name: string): BlockExerciseWithExercise => ({
  id,
  block_id: "blk-1",
  exercise_id: `ex-${id}`,
  name_snapshot: name,
  muscle_snapshot: "chest",
  emoji_snapshot: "💪",
  position: 0,
  per_round: [{ amount: 10, weight: 0 }],
  exercise: null,
})

const block: ExerciseBlockWithExercises = {
  id: "blk-1",
  workout_day_id: "day-1",
  label: "Test superset",
  rounds: 3,
  rest_seconds: 60,
  transition_seconds: 0,
  sort_order: 0,
  created_at: "2020-01-01",
  exercises: [be("A", "Push-ups"), be("B", "Squats")],
}

describe("BlockSessionCard — locale", () => {
  const localizedBlock: ExerciseBlockWithExercises = {
    ...block,
    exercises: [
      {
        ...be("A", "Développé couché"),
        exercise: {
          id: "ex-A",
          name: "Développé couché",
          name_en: "Bench Press",
          muscle_group: "Pectoraux",
          equipment: "barbell",
          emoji: "💪",
        } as BlockExerciseWithExercise["exercise"],
      },
    ],
  }

  it("names the block's exercises in English for an English reader", () => {
    renderWithProviders(<BlockSessionCard block={localizedBlock} />, {
      locale: "en",
    })

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("keeps the French names for a French reader", () => {
    renderWithProviders(<BlockSessionCard block={localizedBlock} />, {
      locale: "fr",
    })

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })
})

describe("BlockSessionCard", () => {
  it("shows the block label, exercise list and starts on click", async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    renderWithProviders(<BlockSessionCard block={block} onStart={onStart} />)

    expect(screen.getByText("Test superset")).toBeInTheDocument()
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
    expect(screen.getByText("Squats")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Start/i }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it("shows each exercise's prescription (reps + weight)", () => {
    const pyramidal: BlockExerciseWithExercise = {
      ...be("C", "Bench"),
      per_round: [
        { amount: 12, weight: 40 },
        { amount: 10, weight: 45 },
        { amount: 8, weight: 50 },
      ],
    }
    const uniform: BlockExerciseWithExercise = {
      ...be("D", "Crunch"),
      per_round: [
        { amount: 15, weight: 0 },
        { amount: 15, weight: 0 },
      ],
    }
    const withBlock: ExerciseBlockWithExercises = {
      ...block,
      exercises: [pyramidal, uniform],
    }
    renderWithProviders(<BlockSessionCard block={withBlock} onStart={vi.fn()} />)

    expect(screen.getByText("12·10·8 reps")).toBeInTheDocument()
    expect(screen.getByText("40 kg – 50 kg")).toBeInTheDocument()
    expect(screen.getByText("15 reps")).toBeInTheDocument()
  })

  it("disables Start when disabled", () => {
    renderWithProviders(
      <BlockSessionCard block={block} onStart={vi.fn()} disabled />,
    )
    expect(screen.getByRole("button", { name: /Start/i })).toBeDisabled()
  })

  it("shows a completed state with a Restart action", () => {
    renderWithProviders(
      <BlockSessionCard block={block} onStart={vi.fn()} completed />,
    )
    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Restart/i })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Start$/i }),
    ).not.toBeInTheDocument()
  })
})
