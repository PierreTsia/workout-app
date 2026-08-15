import type { ReactElement } from "react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { BlockRunner } from "@/components/workout/BlockRunner"
import {
  enqueueBlockRun,
  enqueueSetLog,
  peekSessionRealId,
  queuedBlockRunFor,
} from "@/lib/syncService"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import { authAtom } from "@/store/atoms"
import type {
  BlockExerciseWithExercise,
  Exercise,
  ExerciseBlockWithExercises,
  SetLog,
} from "@/types/database"

const maybeSingle = vi.fn()

vi.mock("@/lib/syncService", () => ({
  enqueueSetLog: vi.fn(),
  scheduleImmediateDrain: vi.fn(),
  peekSessionRealId: vi.fn(() => null),
  discardBlockSetLogs: vi.fn().mockResolvedValue(undefined),
  queuedSetLogPayloadsForSession: vi.fn(() => []),
  queuedBlockRunFor: vi.fn(() => null),
  enqueueBlockRun: vi.fn(),
  discardBlockRun: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle,
          }),
        }),
      }),
    }),
  },
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
  mode: "rounds",
  cap_seconds: null,
  sort_order: 0,
  created_at: "2026-01-01",
  exercises: [be("A", "Push-ups"), be("B", "Squats")],
  ...over,
})

const GO_MS = 4_000

/** Circuits always open on 3-2-1-GO; most tests care about the first station. */
function renderAfterGo(ui: ReactElement, restoreRealTimers = true) {
  vi.useFakeTimers()
  const result = renderWithProviders(ui)
  act(() => {
    vi.advanceTimersByTime(GO_MS)
  })
  if (restoreRealTimers) vi.useRealTimers()
  return result
}

describe("BlockRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queuedBlockRunFor).mockReturnValue(null)
    vi.mocked(peekSessionRealId).mockReturnValue(null)
    maybeSingle.mockResolvedValue({ data: null, error: null })
    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: [] as SetLog[],
    } as ReturnType<typeof useSessionSetLogs>)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("starts on 3-2-1-GO then lands on the first station", () => {
    vi.useFakeTimers()
    renderWithProviders(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.getByRole("region", { name: /get ready/i })).toBeInTheDocument()
    expect(screen.queryByText("Push-ups")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Log$/i }),
    ).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4_000)
    })

    expect(screen.getByText("Push-ups")).toBeInTheDocument()
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Log$/i })).toBeInTheDocument()
  })

  it("shows elapsed chrome after GO that is not a tap target", () => {
    renderAfterGo(<BlockRunner block={block()} localSessionId="local-1" />, false)

    const clock = screen.getByRole("timer", { name: /elapsed/i })
    expect(clock).toHaveTextContent("00:00")
    expect(clock).toHaveClass("pointer-events-none")
    expect(screen.queryByRole("button", { name: /elapsed/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Log$/i })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(clock).toHaveTextContent("00:03")
  })

  it("keeps elapsed chrome up during a transition timer", () => {
    renderAfterGo(
      <BlockRunner
        block={block({ transition_seconds: 20 })}
        localSessionId="local-1"
      />,
      false,
    )

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /^Log$/i }))
    })

    expect(screen.getByText("Rest")).toBeInTheDocument()
    expect(screen.getByRole("timer", { name: /elapsed/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Skip/i })).toBeInTheDocument()
  })

  it("shows the current round, exercise and rep prescription", () => {
    renderAfterGo(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.getByTestId("block-round-count")).toHaveTextContent("1/2")
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByText("reps")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /instructions/i }),
    ).toBeInTheDocument()
  })

  it("resumes on the first empty cell when earlier cells are already logged", () => {
    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: [
        { block_exercise_id: "A", set_number: 1 } as SetLog,
      ] as SetLog[],
    } as ReturnType<typeof useSessionSetLogs>)

    renderAfterGo(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.getByText("Squats")).toBeInTheDocument()
    expect(screen.queryByText("Push-ups")).not.toBeInTheDocument()
  })

  it("shows the validated badge immediately after logging then going back", async () => {
    const user = userEvent.setup()
    renderAfterGo(<BlockRunner block={block()} localSessionId="local-1" />)

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
    renderAfterGo(<BlockRunner block={block()} localSessionId="local-1" />)

    await user.click(screen.getByRole("button", { name: /Log/i }))

    expect(screen.getByText("Squats")).toBeInTheDocument()
    expect(screen.getByTestId("block-exercise-count")).toHaveTextContent("2/2")
  })

  it("disables Back on the very first cell", () => {
    renderAfterGo(<BlockRunner block={block()} localSessionId="local-1" />)

    expect(screen.getByRole("button", { name: /Back/i })).toBeDisabled()
  })

  it("shows a transition countdown and skips to the next exercise", () => {
    renderAfterGo(
      <BlockRunner block={block({ transition_seconds: 20 })} localSessionId="local-1" />,
      false,
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
    renderAfterGo(
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
    const plank = be("A", "Plank", {
      per_round: [{ amount: 30, weight: 0 }],
      exercise: { measurement_type: "duration" } as Exercise,
    })
    renderAfterGo(
      <BlockRunner
        block={block({ rounds: 1, transition_seconds: 0, exercises: [plank] })}
        localSessionId="local-1"
      />,
      false,
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
    expect(screen.queryByText("Circuit complete")).not.toBeInTheDocument()
    const validate = screen.getByRole("button", { name: /Log/i })

    act(() => {
      fireEvent.click(validate)
    })
    expect(screen.getByText("Circuit complete")).toBeInTheDocument()
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
    renderAfterGo(
      <BlockRunner
        block={block()}
        localSessionId="local-1"
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole("button", { name: /^Cancel$/i }))
    expect(screen.getByText("Cancel?")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Delete & exit/i }))
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce())
  })

  it("keeps running when the cancel dialog is dismissed", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderAfterGo(
      <BlockRunner
        block={block()}
        localSessionId="local-1"
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole("button", { name: /^Cancel$/i }))
    await user.click(screen.getByRole("button", { name: /Keep going/i }))

    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
  })

  it("fires onComplete once when the block reaches done", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    renderAfterGo(
      <BlockRunner
        block={block({ rounds: 1, exercises: [be("A", "Push-ups")] })}
        localSessionId="local-1"
        onComplete={onComplete}
      />,
    )

    expect(onComplete).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: /Log/i }))

    expect(screen.getByText("Circuit complete")).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it("reaches the done state after the last cell and calls onExit", async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    renderAfterGo(
      <BlockRunner
        block={block({ rounds: 1, exercises: [be("A", "Push-ups")] })}
        localSessionId="local-1"
        onExit={onExit}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Log/i }))

    expect(screen.getByText("Circuit complete")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Back to session/i }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it("hides Skip on AMRAP and shows Tour N without a denominator", () => {
    renderAfterGo(
      <BlockRunner
        block={block({
          mode: "amrap",
          cap_seconds: 1200,
          rounds: 1,
          rest_seconds: 0,
          transition_seconds: 0,
        })}
        localSessionId="local-1"
      />,
    )

    expect(screen.queryByRole("button", { name: /Skip/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Finish/i })).toBeInTheDocument()
    expect(screen.getByTestId("block-round-count")).toHaveTextContent("1")
    expect(screen.getByTestId("block-round-count")).not.toHaveTextContent("/")
  })

  it("captures leftover via Finish and shows a glossed AmrapScore", async () => {
    const user = userEvent.setup()
    renderAfterGo(
      <BlockRunner
        block={block({
          mode: "amrap",
          cap_seconds: 1200,
          rounds: 1,
          rest_seconds: 0,
          transition_seconds: 0,
        })}
        localSessionId="local-1"
      />,
    )

    await user.click(screen.getByRole("button", { name: /Log/i }))
    await user.click(screen.getByRole("button", { name: /Log/i }))
    await user.click(screen.getByRole("button", { name: /Finish/i }))

    expect(screen.getByRole("region", { name: /TIME/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /increase/i }))
    await user.click(screen.getByRole("button", { name: /increase/i }))
    await user.click(screen.getByRole("button", { name: /increase/i }))
    await user.click(screen.getByRole("button", { name: /log leftover/i }))

    expect(screen.getByText("1+3")).toBeInTheDocument()
    expect(screen.getByText("1 rounds · 3 Push-ups")).toBeInTheDocument()
    expect(enqueueSetLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ repsLogged: "3", setNumber: 2 }),
    )
  })

  it("skips a second GO when a Block Run is already queued and restores remaining cap", () => {
    const t0 = 1_700_000_000_000
    vi.useFakeTimers()
    vi.setSystemTime(t0)
    vi.mocked(queuedBlockRunFor).mockReturnValue({
      sessionId: "local-1",
      blockId: "blk-1",
      startedAt: t0 - 12 * 60 * 1000,
      finishedAt: null,
      mode: "amrap",
      capSeconds: 20 * 60,
      templateFingerprint: "amrap|1200|ex-A:20:0",
    })

    renderWithProviders(
      <BlockRunner
        block={block({
          mode: "amrap",
          cap_seconds: 20 * 60,
          rounds: 1,
        })}
        localSessionId="local-1"
      />,
    )

    expect(
      screen.queryByRole("region", { name: /get ready/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Push-ups")).toBeInTheDocument()
    expect(screen.getByRole("timer", { name: /remaining/i })).toHaveTextContent(
      "08:00",
    )
  })

  it("enqueues a Block Run at GO for AMRAP", () => {
    renderAfterGo(
      <BlockRunner
        block={block({ mode: "amrap", cap_seconds: 1200, rounds: 1 })}
        localSessionId="local-1"
      />,
    )

    expect(enqueueBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "local-1",
        blockId: "blk-1",
        mode: "amrap",
        capSeconds: 1200,
        finishedAt: null,
      }),
    )
  })

  it("restores the cursor from drained set_logs after hydrate, not (0,0)", async () => {
    const t0 = 1_700_000_000_000
    vi.spyOn(Date, "now").mockReturnValue(t0)
    vi.mocked(peekSessionRealId).mockReturnValue("real-1")
    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: undefined,
      isPending: true,
    } as ReturnType<typeof useSessionSetLogs>)
    maybeSingle.mockResolvedValue({
      data: {
        started_at: new Date(t0 - 12 * 60 * 1000).toISOString(),
        finished_at: null,
      },
      error: null,
    })

    const cindy = block({
      mode: "amrap",
      cap_seconds: 20 * 60,
      rounds: 1,
    })
    const { store, rerender } = renderWithProviders(<div />)
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })
    rerender(<BlockRunner block={cindy} localSessionId="local-1" />)

    expect(screen.queryByText("Push-ups")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: /get ready/i }),
    ).not.toBeInTheDocument()

    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: [{ block_exercise_id: "A", set_number: 1 } as SetLog],
    } as ReturnType<typeof useSessionSetLogs>)
    rerender(<BlockRunner block={cindy} localSessionId="local-1" />)

    await waitFor(() => {
      expect(screen.getByText("Squats")).toBeInTheDocument()
    })
    expect(screen.queryByText("Push-ups")).not.toBeInTheDocument()
    expect(screen.getByRole("timer", { name: /remaining/i })).toHaveTextContent(
      "08:00",
    )
  })

  it("opens a finished AMRAP on the done screen, not as a live run", async () => {
    const t0 = 1_700_000_000_000
    vi.spyOn(Date, "now").mockReturnValue(t0)
    vi.mocked(peekSessionRealId).mockReturnValue("real-1")
    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: undefined,
      isPending: true,
    } as ReturnType<typeof useSessionSetLogs>)
    maybeSingle.mockResolvedValue({
      data: {
        started_at: new Date(t0 - 20 * 60 * 1000).toISOString(),
        finished_at: new Date(t0).toISOString(),
      },
      error: null,
    })

    const cindy = block({
      mode: "amrap",
      cap_seconds: 20 * 60,
      rounds: 1,
    })
    const { store, rerender } = renderWithProviders(<div />)
    act(() => {
      store.set(authAtom, { id: "user-1" } as never)
    })
    rerender(<BlockRunner block={cindy} localSessionId="local-1" />)

    vi.mocked(useSessionSetLogs).mockReturnValue({
      data: [
        { block_exercise_id: "A", set_number: 1 } as SetLog,
        { block_exercise_id: "B", set_number: 1 } as SetLog,
      ],
    } as ReturnType<typeof useSessionSetLogs>)
    rerender(<BlockRunner block={cindy} localSessionId="local-1" />)

    await waitFor(() => {
      expect(screen.getByText("Circuit complete")).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /^Log$/i })).not.toBeInTheDocument()
  })
})
