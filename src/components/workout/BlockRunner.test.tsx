import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlockRunner } from "@/components/workout/BlockRunner"
import { enqueueSetLog } from "@/lib/syncService"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import type {
  BlockExerciseWithExercise,
  Exercise,
  ExerciseBlockWithExercises,
  SetLog,
} from "@/types/database"

vi.mock("@/lib/syncService", () => ({
  enqueueSetLog: vi.fn(),
  scheduleImmediateDrain: vi.fn(),
  peekSessionRealId: vi.fn(() => null),
  discardBlockSetLogs: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/hooks/useSessionSetLogs", () => ({
  useSessionSetLogs: vi.fn(() => ({ data: [] as SetLog[] })),
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
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: [] as SetLog[],
    } as ReturnType<typeof useSessionSetLogs>)
  })
  afterEach(() => vi.useRealTimers())

  it("shows the current round, exercise and rep prescription", () => {
    renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.getByTestId("block-round-count")).toHaveTextContent("1/2")
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByText("reps")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /instructions/i }),
    ).toBeInTheDocument()
  })

  it("marks an already-logged cell as validated and advances without re-logging", async () => {
    const user = userEvent.setup()
    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: [
        { block_exercise_id: "A", set_number: 1 } as SetLog,
      ] as SetLog[],
    } as ReturnType<typeof useSessionSetLogs>)

    renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)

    // First cell is already in set_logs: show it as logged, no fresh "Log".
    expect(screen.getByText("Logged")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Log$/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Next/i }))

    // Moved on to the next exercise, and no duplicate set_log was enqueued.
    expect(screen.getByText("Squats")).toBeInTheDocument()
    expect(enqueueSetLog).not.toHaveBeenCalled()
  })

  it("shows the validated badge immediately after logging then going back", async () => {
    const user = userEvent.setup()
    renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.queryByText("Logged")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^Log$/i }))
    expect(screen.getByText("Squats")).toBeInTheDocument()

    // Back onto the just-logged cell shows it validated right away (optimistic),
    // without waiting for the set_logs round-trip.
    await user.click(screen.getByRole("button", { name: /Back/i }))
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
    expect(screen.getByText("Logged")).toBeInTheDocument()
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

  it("holds a duration cell, then waits for an explicit Validate at zero", () => {
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

    expect(screen.getByText("30")).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Start/i }))
    })
    // Same layout: the center number simply starts ticking down in place,
    // and the action becomes a de-emphasized Skip while running.
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByText("29")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Skip/i })).toBeInTheDocument()

    // At zero the hold stops but does NOT auto-advance: it awaits a Validate.
    act(() => {
      vi.advanceTimersByTime(29_000)
    })
    expect(screen.queryByText("Block complete")).not.toBeInTheDocument()
    const validate = screen.getByRole("button", { name: /Log/i })

    act(() => {
      fireEvent.click(validate)
    })
    expect(screen.getByText("Block complete")).toBeInTheDocument()
  })

  it("keeps the screen awake while the block is running", async () => {
    const request = vi.fn().mockResolvedValue({
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    Object.defineProperty(navigator, "wakeLock", {
      value: { request },
      configurable: true,
    })
    try {
      renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)
      await waitFor(() => expect(request).toHaveBeenCalledWith("screen"))
    } finally {
      delete (navigator as { wakeLock?: unknown }).wakeLock
    }
  })

  it("does not keep the screen awake when paused", () => {
    const request = vi.fn()
    Object.defineProperty(navigator, "wakeLock", {
      value: { request },
      configurable: true,
    })
    try {
      renderWithProviders(
        <BlockRunner block={block()} localSessionId="local-1" paused />,
      )
      expect(request).not.toHaveBeenCalled()
    } finally {
      delete (navigator as { wakeLock?: unknown }).wakeLock
    }
  })

  it("cancels the block after confirmation and returns to the selector", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderWithProviders(
      <BlockRunner
        block={block()}
        localSessionId="local-1"
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Cancel block/i }))
    expect(screen.getByText("Cancel this block?")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Delete & exit/i }))
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce())
  })

  it("keeps running when the cancel dialog is dismissed", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderWithProviders(
      <BlockRunner
        block={block()}
        localSessionId="local-1"
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Cancel block/i }))
    await user.click(screen.getByRole("button", { name: /Keep going/i }))

    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
  })

  it("fires onComplete once when the block reaches done", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    renderWithProviders(
      <BlockRunner
        block={block({ rounds: 1, exercises: [be("A", "Push-ups")] })}
        localSessionId="local-1"
        onComplete={onComplete}
      />,
    )

    expect(onComplete).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: /Log/i }))

    expect(screen.getByText("Block complete")).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledOnce()
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
    await user.click(screen.getByRole("button", { name: /Back to session/i }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
