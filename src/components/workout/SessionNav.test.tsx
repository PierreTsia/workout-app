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
      <SessionNav exercises={EXERCISES} onFinishAttempt={vi.fn()} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0 })
    })

    expect(screen.getByText("Finish workout early")).toBeInTheDocument()
  })

  it("hides 'Finish workout early' on the last exercise", () => {
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinishAttempt={vi.fn()} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 2 })
    })

    expect(screen.queryByText("Finish workout early")).not.toBeInTheDocument()
  })

  it("delegates the finish attempt instead of owning a dialog", async () => {
    const user = userEvent.setup()
    const onFinishAttempt = vi.fn()
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinishAttempt={onFinishAttempt} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0 })
    })

    await user.click(screen.getByText("Finish workout early"))

    expect(onFinishAttempt).toHaveBeenCalledOnce()
    expect(screen.queryByText("Finish session?")).not.toBeInTheDocument()
  })

  it("delegates the finish attempt from Finish on the last item", async () => {
    const user = userEvent.setup()
    const onFinishAttempt = vi.fn()
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinishAttempt={onFinishAttempt} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 2 })
    })

    await user.click(screen.getByText("Finish"))

    expect(onFinishAttempt).toHaveBeenCalledOnce()
  })

  it("does not navigate to the next exercise on the last item", async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} onFinishAttempt={vi.fn()} />,
    )
    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 2 })
    })

    await user.click(screen.getByText("Finish"))

    expect(store.get(sessionAtom).exerciseIndex).toBe(2)
  })

  it("treats the last solo as non-final when blocks extend the sequence (itemCount)", () => {
    const { store } = renderWithProviders(
      <SessionNav exercises={EXERCISES} itemCount={4} onFinishAttempt={vi.fn()} />,
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
      <SessionNav exercises={EXERCISES} onFinishAttempt={vi.fn()} />,
    )

    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0 })
    })

    await user.click(screen.getByText("Next"))

    expect(store.get(sessionAtom).exerciseIndex).toBe(1)
  })
})
