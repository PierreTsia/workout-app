import { describe, it, expect, vi } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { sessionAtom, type SessionState } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { useFinishSessionAttempt } from "./useFinishSessionAttempt"

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

function renderAttempt(
  overrides: Partial<Parameters<typeof useFinishSessionAttempt>[0]> = {},
) {
  const onFinish = vi.fn()
  const onBlockedByPause = vi.fn()
  const onAbandon = vi.fn()
  const rendered = renderHookWithProviders(() =>
    useFinishSessionAttempt({
      exercises: EXERCISES,
      onFinish,
      onBlockedByPause,
      onAbandon,
      ...overrides,
    }),
  )
  return { ...rendered, onFinish, onBlockedByPause, onAbandon }
}

describe("useFinishSessionAttempt", () => {
  it("opens the confirm dialog when work remains", () => {
    const { result, store, onFinish } = renderAttempt()

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 0,
        setsData: {
          "ex-1": [{ kind: "reps", reps: "10", weight: "60", done: false }],
        },
      })
    })
    act(() => result.current.attempt())

    expect(result.current.confirmOpen).toBe(true)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it("abandons instead of finishing when no set was logged (#654)", () => {
    const { result, store, onFinish, onAbandon } = renderAttempt({ setsDone: 0 })

    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0 })
    })
    act(() => result.current.attempt())

    expect(onAbandon).toHaveBeenCalledOnce()
    expect(onFinish).not.toHaveBeenCalled()
    expect(result.current.confirmOpen).toBe(false)
  })

  it("finishes directly when nothing is left", () => {
    const { result, store, onFinish } = renderAttempt()

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
    act(() => result.current.attempt())

    expect(onFinish).toHaveBeenCalledOnce()
    expect(result.current.confirmOpen).toBe(false)
  })

  it("finishes when the confirm is accepted", () => {
    const { result, store, onFinish } = renderAttempt()

    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0 })
    })
    act(() => result.current.attempt())
    act(() => result.current.confirmFinish())

    expect(onFinish).toHaveBeenCalledOnce()
    expect(result.current.confirmOpen).toBe(false)
  })

  it("defers to the pause handler instead of opening the confirm", () => {
    const { result, store, onFinish, onBlockedByPause } = renderAttempt()

    act(() => {
      store.set(sessionAtom, { ...BASE_SESSION, exerciseIndex: 0, pausedAt: Date.now() })
    })
    act(() => result.current.attempt())

    expect(onBlockedByPause).toHaveBeenCalledOnce()
    expect(onFinish).not.toHaveBeenCalled()
    expect(result.current.confirmOpen).toBe(false)
  })

  it("names skipped sets and remaining work together", () => {
    const { result, store } = renderAttempt()

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 0,
        setsData: {
          "ex-1": [{ kind: "reps", reps: "10", weight: "60", done: false }],
        },
      })
    })

    expect(result.current.confirmBody).toBe(
      "You have 1 skipped set and still have exercises or circuits left. Finish anyway?",
    )
  })

  it("names only the skipped sets when the last item has nothing ahead", () => {
    const { result, store } = renderAttempt()

    act(() => {
      store.set(sessionAtom, {
        ...BASE_SESSION,
        exerciseIndex: 2,
        setsData: {
          "ex-1": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-2": [{ kind: "reps", reps: "10", weight: "60", done: true }],
          "ex-3": [{ kind: "reps", reps: "10", weight: "60", done: false }],
        },
      })
    })

    expect(result.current.confirmBody).toBe("You have 1 skipped set. Finish anyway?")
  })

  it("names only the remaining work when nothing is skipped", () => {
    const { result, store } = renderAttempt()

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

    expect(result.current.confirmBody).toBe(
      "You still have exercises or circuits left. Finish anyway?",
    )
  })

  it("asks for confirmation on the last item when a circuit is still incomplete", () => {
    const { result, store, onFinish } = renderAttempt({ incompleteBlockCount: 1 })

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
    act(() => result.current.attempt())

    expect(result.current.confirmOpen).toBe(true)
    expect(onFinish).not.toHaveBeenCalled()
  })
})
