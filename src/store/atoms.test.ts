import { describe, expect, it } from "vitest"
import { createStore } from "jotai"
import { sessionAtom, completedExerciseIdsAtom } from "./atoms"

describe("completedExerciseIdsAtom", () => {
  it("returns empty set when no sets data exists", () => {
    const store = createStore()
    const completed = store.get(completedExerciseIdsAtom)
    expect(completed.size).toBe(0)
  })

  it("returns empty set when exercises have no sets", () => {
    const store = createStore()
    store.set(sessionAtom, {
      currentDayId: "day-1",
      activeDayId: "day-1",
      exerciseIndex: 0,
      setsData: {
        "exercise-1": [],
      },
      startedAt: Date.now(),
      isActive: true,
      totalSetsDone: 0,
      pausedAt: null,
      accumulatedPause: 0,
      cycleId: null,
    })

    const completed = store.get(completedExerciseIdsAtom)
    expect(completed.size).toBe(0)
  })

  it("returns empty set when some sets are not done", () => {
    const store = createStore()
    store.set(sessionAtom, {
      currentDayId: "day-1",
      activeDayId: "day-1",
      exerciseIndex: 0,
      setsData: {
        "exercise-1": [
          { kind: "reps", reps: "10", weight: "50", done: true },
          { kind: "reps", reps: "10", weight: "50", done: false },
          { kind: "reps", reps: "10", weight: "50", done: true },
        ],
      },
      startedAt: Date.now(),
      isActive: true,
      totalSetsDone: 2,
      pausedAt: null,
      accumulatedPause: 0,
      cycleId: null,
    })

    const completed = store.get(completedExerciseIdsAtom)
    expect(completed.has("exercise-1")).toBe(false)
  })

  it("returns exercise id when all sets are done", () => {
    const store = createStore()
    store.set(sessionAtom, {
      currentDayId: "day-1",
      activeDayId: "day-1",
      exerciseIndex: 0,
      setsData: {
        "exercise-1": [
          { reps: "10", weight: "50", done: true },
          { reps: "10", weight: "50", done: true },
          { reps: "10", weight: "50", done: true },
        ],
      },
      startedAt: Date.now(),
      isActive: true,
      totalSetsDone: 3,
      pausedAt: null,
      accumulatedPause: 0,
      cycleId: null,
    })

    const completed = store.get(completedExerciseIdsAtom)
    expect(completed.has("exercise-1")).toBe(true)
  })

  it("returns multiple exercise ids when multiple exercises are completed", () => {
    const store = createStore()
    store.set(sessionAtom, {
      currentDayId: "day-1",
      activeDayId: "day-1",
      exerciseIndex: 2,
      setsData: {
        "exercise-1": [
          { kind: "reps", reps: "10", weight: "50", done: true },
          { kind: "reps", reps: "10", weight: "50", done: true },
        ],
        "exercise-2": [
          { kind: "reps", reps: "8", weight: "60", done: true },
          { kind: "reps", reps: "8", weight: "60", done: true },
        ],
        "exercise-3": [
          { kind: "reps", reps: "12", weight: "40", done: false },
        ],
      },
      startedAt: Date.now(),
      isActive: true,
      totalSetsDone: 4,
      pausedAt: null,
      accumulatedPause: 0,
      cycleId: null,
    })

    const completed = store.get(completedExerciseIdsAtom)
    expect(completed.size).toBe(2)
    expect(completed.has("exercise-1")).toBe(true)
    expect(completed.has("exercise-2")).toBe(true)
    expect(completed.has("exercise-3")).toBe(false)
  })
})
