import { describe, expect, it, beforeEach } from "vitest"
import { createStore } from "jotai"
import {
  sessionAtom,
  completedExerciseIdsAtom,
  prFlagsAtom,
  sessionBestPerformanceAtom,
} from "./atoms"

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
          { kind: "reps", reps: "10", weight: "50", done: true },
          { kind: "reps", reps: "10", weight: "50", done: true },
          { kind: "reps", reps: "10", weight: "50", done: true },
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

/**
 * Regression #291 — PRs hit during a session must survive a hard reload so
 * the post-session bilan still shows them. Both atoms back the PR badge
 * pipeline (prFlagsAtom drives `prExercises`; sessionBestPerformanceAtom
 * keeps the in-session running best for live PR detection).
 *
 * Tests cover the round-trip: writes propagate to localStorage, and a fresh
 * store mounting the atom (mirroring `useAtom` after a page reload) reads
 * the value back. If either atom regresses to a plain `atom`, these fail.
 *
 * Note on store semantics: `atomWithStorage` reads localStorage at module
 * load (`getOnInit`) or on atom mount (`onMount`). Calling `store.get()` on
 * a fresh store without subscribing does NOT re-read storage — it returns
 * the baseAtom's module-load default. We must `store.sub()` to mount the
 * atom, which is exactly what `useAtom` does in components.
 */
describe("session PR atoms persist across reloads (regression #291)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("writes prFlagsAtom values to localStorage", () => {
    const store = createStore()
    store.set(prFlagsAtom, { "ex-1": true, "ex-2": true })

    expect(localStorage.getItem("prFlags")).toBe(
      JSON.stringify({ "ex-1": true, "ex-2": true }),
    )
  })

  it("hydrates prFlagsAtom from localStorage on mount (simulates page reload)", () => {
    localStorage.setItem(
      "prFlags",
      JSON.stringify({ "ex-1": true, "ex-2": true }),
    )

    const store = createStore()
    const unsub = store.sub(prFlagsAtom, () => {})

    expect(store.get(prFlagsAtom)).toEqual({ "ex-1": true, "ex-2": true })
    unsub()
  })

  it("writes sessionBestPerformanceAtom values to localStorage", () => {
    const store = createStore()
    store.set(sessionBestPerformanceAtom, { "ex-1": 100, "ex-2": 95 })

    expect(localStorage.getItem("sessionBestPerformance")).toBe(
      JSON.stringify({ "ex-1": 100, "ex-2": 95 }),
    )
  })

  it("hydrates sessionBestPerformanceAtom from localStorage on mount", () => {
    localStorage.setItem(
      "sessionBestPerformance",
      JSON.stringify({ "ex-1": 100, "ex-2": 95 }),
    )

    const store = createStore()
    const unsub = store.sub(sessionBestPerformanceAtom, () => {})

    expect(store.get(sessionBestPerformanceAtom)).toEqual({
      "ex-1": 100,
      "ex-2": 95,
    })
    unsub()
  })

  it("clears the persisted prFlags when the atom is reset to empty", () => {
    const store = createStore()
    store.set(prFlagsAtom, { "ex-1": true })
    store.set(prFlagsAtom, {})

    expect(localStorage.getItem("prFlags")).toBe(JSON.stringify({}))
  })
})
