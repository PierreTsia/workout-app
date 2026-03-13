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
          "ex-1": [{ reps: "10", weight: "60", done: false }],
        },
      })
    })

    await user.click(screen.getByText("Finish workout early"))

    expect(screen.getByText("Finish session?")).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it("calls onFinish directly when clicking finish early with all sets done", async () => {
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
          "ex-1": [{ reps: "10", weight: "60", done: true }],
          "ex-2": [{ reps: "10", weight: "60", done: true }],
          "ex-3": [{ reps: "10", weight: "60", done: true }],
        },
      })
    })

    await user.click(screen.getByText("Finish workout early"))

    expect(onFinish).toHaveBeenCalledOnce()
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
