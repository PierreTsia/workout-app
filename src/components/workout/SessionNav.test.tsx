import { describe, it, expect, vi } from "vitest"
import { screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { sessionAtom, type SessionState } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { SessionNav } from "./SessionNav"

function makeExercise(id: string): WorkoutExercise {
  return {
    id,
    workout_day_id: "day-1",
    exercise_id: `lib-${id}`,
    name_snapshot: `Exercise ${id}`,
    muscle_snapshot: "Chest",
    emoji_snapshot: "💪",
    sets: 3,
    reps: "10",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    target_duration_seconds: null,
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
    template_updated_at: "2020-01-01T00:00:00Z",
  }
}

const EXERCISES = [makeExercise("ex-1"), makeExercise("ex-2"), makeExercise("ex-3")]

const BASE_SESSION: SessionState = {
  currentDayId: "day-1",
  activeDayId: "day-1",
  exerciseIndex: 0,
  setsData: {},
  startedAt: Date.now(),
  isActive: true,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
  cycleId: null,
}

describe("SessionNav", () => {
  it("shows 'Finish workout early' when NOT on last exercise", () => {
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinish={vi.fn()} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0 })
    })

    expect(screen.getByText("Finish workout early")).toBeInTheDocument()
  })

  it("hides 'Finish workout early' on the last exercise", () => {
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinish={vi.fn()} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 2 })
    })

    expect(screen.queryByText("Finish workout early")).not.toBeInTheDocument()
  })

  it("opens confirmation dialog when clicking finish early with undone sets", async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinish={onFinish} />,
    )

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 0,
        setsData: {
          "ex-1": [{ kind: "reps", reps: "10", weight: "60", done: false }],
        },
      })
    })

    await user.click(screen.getByText("Finish workout early"))

    expect(screen.getByText("Finish session?")).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it("asks for confirmation when finishing early with all sets done but items ahead", async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinish={onFinish} />,
    )

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 0,
        setsData: {
          "ex-1": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-2": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-3": [{ kind: "reps", reps: "10", weight: "60", done: true }],
        },
      })
    })

    await user.click(screen.getByText("Finish workout early"))

    expect(screen.getByText("Finish session?")).toBeInTheDocument()
    expect(
      screen.getByText(
        "You still have exercises or circuits left. Finish anyway?",
      ),
    ).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })

  // Repro: circuit → plank → circuit. User finishes plank sets, taps FR
  // "Terminer la séance" (finishEarly). Solo sets are all done so the guard
  // used to skip confirmation and drop the trailing circuit silently.
  it("asks for confirmation when finishing early with items still ahead (all solo sets done)", async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const plank = makeExercise("plank")
    const { store } = renderWithProviders(
      <SessionNav exercises={[plank]} itemCount={3} onFinish={onFinish} />,
    )

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 1,
        setsData: {
          plank: [
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
            {
              kind: "duration",
              targetSeconds: 45,
              weight: "0",
              done: true,
              timerStartedAt: null,
            },
          ],
        },
      })
    })

    await user.click(screen.getByText("Finish workout early"))

    expect(screen.getByText("Finish session?")).toBeInTheDocument()
    expect(
      screen.getByText(
        "You still have exercises or circuits left. Finish anyway?",
      ),
    ).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it("calls onFinish directly from Finish on last item when nothing is left", async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinish={onFinish} />,
    )

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 2,
        setsData: {
          "ex-1": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-2": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-3": [{ kind: "reps", reps: "10", weight: "60", done: true }],
        },
      })
    })

    await user.click(screen.getByText("Finish"))

    expect(onFinish).toHaveBeenCalledOnce()
  })

  it("asks for confirmation on last item when a circuit is still incomplete", async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const { store } = renderWithProviders(
      <SessionNav
        exercises={EXERCISES}
        incompleteBlockCount={1}
        onFinish={onFinish}
      />,
    )

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 2,
        setsData: {
          "ex-1": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-2": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-3": [{ kind: "reps", reps: "10", weight: "60", done: true }],
        },
      })
    })

    await user.click(screen.getByText("Finish"))

    expect(screen.getByText("Finish session?")).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it("treats the last solo as non-final when blocks extend the sequence (itemCount)", () => {
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} itemCount={4} onFinish={vi.fn()} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 2 })
    })

    // index 2 of 4 slots → not last anymore, so "finish early" is offered.
    expect(screen.getByText("Finish workout early")).toBeInTheDocument()
    expect(screen.getByText("Next")).toBeInTheDocument()
  })

  it("navigates to next exercise when clicking Next", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinish={vi.fn()} />,
    )

    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0 })
    })

    await user.click(screen.getByText("Next"))

    expect(store.get(sessionAtom).exerciseIndex).toBe(1)
  })
})
