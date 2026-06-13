import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { SessionBlocksSection } from "@/components/workout/SessionBlocksSection"
import type { ExerciseBlockWithExercises } from "@/types/database"

const block = (
  over: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises => ({
  id: "blk-1",
  workout_day_id: "day-1",
  label: "Finisher",
  rounds: 3,
  rest_seconds: 60,
  transition_seconds: 0,
  sort_order: 0,
  created_at: "2026-01-01",
  exercises: [],
  ...over,
})

describe("SessionBlocksSection", () => {
  it("renders nothing when there are no blocks", () => {
    const { container } = renderWithProviders(
      <SessionBlocksSection blocks={[]} onRun={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("lists each block and fires onRun with its id", async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    renderWithProviders(
      <SessionBlocksSection blocks={[block()]} onRun={onRun} />,
    )

    expect(screen.getByText("Finisher")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Start/i }))
    expect(onRun).toHaveBeenCalledWith("blk-1")
  })

  it("falls back to a default label when the block is unnamed", () => {
    renderWithProviders(
      <SessionBlocksSection blocks={[block({ label: null })]} onRun={vi.fn()} />,
    )
    expect(screen.getByText("Circuit")).toBeInTheDocument()
  })
})
