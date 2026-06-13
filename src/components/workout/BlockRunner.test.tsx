import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { act, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlockRunner } from "@/components/workout/BlockRunner"
import type {
  BlockExerciseWithExercise,
  Exercise,
  ExerciseBlockWithExercises,
} from "@/types/database"

vi.mock("@/lib/syncService", () => ({
  enqueueSetLog: vi.fn(),
  scheduleImmediateDrain: vi.fn(),
  peekSessionRealId: vi.fn(() => null),
}))

vi.mock("@/lib/audio", () => ({ playFinishBeeps: vi.fn() }))

const be = (
  id: string,
  name: string,
  over: Partial<BlockExerciseWithExercise> = {},
): BlockExerciseWithExercise => ({
  id,
  block_id: "blk-1",
  exercise_id: `ex-${id}`,
  name_snapshot: name,
  muscle_snapshot: "chest",
  emoji_snapshot: "💪",
  position: 0,
  per_round: [
    { amount: 20, weight: 0 },
    { amount: 15, weight: 0 },
  ],
  exercise: null,
  ...over,
})

const block = (
  over: Partial<ExerciseBlockWithExercises> = {},
): ExerciseBlockWithExercises => ({
  id: "blk-1",
  workout_day_id: "day-1",
  label: "Circuit",
  rounds: 2,
  rest_seconds: 0,
  transition_seconds: 0,
  sort_order: 0,
  created_at: "2026-01-01",
  exercises: [be("A", "Push-ups"), be("B", "Squats")],
  ...over,
})

describe("BlockRunner", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it("shows the current round, exercise and rep prescription", () => {
    renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.getByTestId("block-round-count")).toHaveTextContent("1/2")
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
    expect(screen.getByText("20 reps")).toBeInTheDocument()
  })

  it("advances to the next exercise when logging (no transition)", async () => {
    const user = userEvent.setup()
    renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)

    await user.click(screen.getByRole("button", { name: /Log/i }))

    expect(screen.getByText("Squats")).toBeInTheDocument()
    expect(screen.getByTestId("block-exercise-count")).toHaveTextContent("2/2")
  })

  it("disables Back on the very first cell", () => {
    renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.getByRole("button", { name: /Back/i })).toBeDisabled()
  })

  it("shows a transition countdown and skips to the next exercise", () => {
    vi.useFakeTimers()
    renderWithProviders(
      <BlockRunner block={block({ transition_seconds: 20 })} localSessionId="local-1" />,
    )

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Log/i }))
    })

    expect(screen.getByText("Rest")).toBeInTheDocument()
    expect(screen.getByText("00:20")).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Skip/i }))
    })

    expect(screen.getByText("Squats")).toBeInTheDocument()
  })

  it("renders round and exercise progress bars filled to position", () => {
    renderWithProviders(
      <BlockRunner
        block={block({ rounds: 4, exercises: [be("A", "Push-ups"), be("B", "Squats")] })}
        localSessionId="local-1"
      />,
    )

    // Round 1/4 → 25%, Exercise 1/2 → 50%.
    expect(screen.getByTestId("block-round-count")).toHaveTextContent("1/4")
    expect(screen.getByTestId("block-round-fill")).toHaveStyle({ width: "25%" })
    expect(screen.getByTestId("block-exercise-count")).toHaveTextContent("1/2")
    expect(screen.getByTestId("block-exercise-fill")).toHaveStyle({ width: "50%" })
  })

  it("runs an individual hold timer for duration cells and auto-logs at zero", () => {
    vi.useFakeTimers()
    const plank = be("A", "Plank", {
      per_round: [{ amount: 30, weight: 0 }],
      exercise: { measurement_type: "duration" } as Exercise,
    })
    renderWithProviders(
      <BlockRunner
        block={block({ rounds: 1, transition_seconds: 0, exercises: [plank] })}
        localSessionId="local-1"
      />,
    )

    expect(screen.getByText("30s")).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Start/i }))
    })
    expect(screen.getByText("00:30")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText("Block complete")).toBeInTheDocument()
  })

  it("reaches the done state after the last cell and calls onExit", async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    renderWithProviders(
      <BlockRunner
        block={block({ rounds: 1, exercises: [be("A", "Push-ups")] })}
        localSessionId="local-1"
        onExit={onExit}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Log/i }))

    expect(screen.getByText("Block complete")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Done/i }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
