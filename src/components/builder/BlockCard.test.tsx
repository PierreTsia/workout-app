import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { DndContext } from "@dnd-kit/core"
import { SortableContext } from "@dnd-kit/sortable"
import { renderWithProviders } from "@/test/utils"
import { BlockCard } from "@/components/builder/BlockCard"
import type { ExerciseBlockWithExercises } from "@/types/database"

function makeBlock(
  overrides: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises {
  return {
    id: "b-1",
    workout_day_id: "day-1",
    label: null,
    rounds: 3,
    rest_seconds: 90,
    transition_seconds: 20,
    mode: "rounds",
    cap_seconds: null,
    sort_order: 0,
    created_at: "1970-01-01T00:00:00Z",
    exercises: [
      {
        id: "be-1",
        block_id: "b-1",
        exercise_id: "ex-1",
        name_snapshot: "Burpee",
        muscle_snapshot: "full",
        emoji_snapshot: "🔥",
        position: 0,
        per_round: [{ amount: 10, weight: 0 }],
        exercise: null,
      },
      {
        id: "be-2",
        block_id: "b-1",
        exercise_id: "ex-2",
        name_snapshot: "Lunge",
        muscle_snapshot: "legs",
        emoji_snapshot: "🦵",
        position: 1,
        per_round: [{ amount: 12, weight: 0 }],
        exercise: null,
      },
    ],
    ...overrides,
  }
}

describe("BlockCard", () => {
  it("shows the round count and each exercise name", () => {
    const block = makeBlock()
    renderWithProviders(
      <DndContext>
        <SortableContext items={[block.id]}>
          <BlockCard block={block} />
        </SortableContext>
      </DndContext>,
    )

    expect(screen.getByText(/3 rounds/i)).toBeInTheDocument()
    expect(screen.getByText("Burpee")).toBeInTheDocument()
    expect(screen.getByText("Lunge")).toBeInTheDocument()
  })

  it("shows inline AmrapLabel next to the title, not a gloss row", () => {
    const block = makeBlock({
      mode: "amrap",
      cap_seconds: 1200,
      rounds: 1,
    })
    renderWithProviders(
      <DndContext>
        <SortableContext items={[block.id]}>
          <BlockCard block={block} />
        </SortableContext>
      </DndContext>,
    )

    expect(screen.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(
      screen.queryByText("As many rounds as possible."),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/1 round/i)).not.toBeInTheDocument()
  })
})
