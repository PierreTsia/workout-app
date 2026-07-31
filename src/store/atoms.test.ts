import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { createStore } from "jotai"
import {
  sessionAtom,
  completedExerciseIdsAtom,
  completedBlockIdsAtom,
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

describe("completedBlockIdsAtom", () => {
  it("is empty by default", () => {
    const store = createStore()
    expect(store.get(completedBlockIdsAtom).size).toBe(0)
  })

  it("reflects the session's completedBlockIds", () => {
    const store = createStore()
    store.set(sessionAtom, {
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
      completedBlockIds: ["blk-1", "blk-2"],
    })

    const completed = store.get(completedBlockIdsAtom)
    expect(completed.has("blk-1")).toBe(true)
    expect(completed.has("blk-2")).toBe(true)
    expect(completed.has("blk-3")).toBe(false)
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

describe("localeAtom default", () => {
  async function localeFor(language: string) {
    localStorage.clear()
    vi.resetModules()
    vi.stubGlobal("navigator", { language })
    const { localeAtom } = await import("./atoms")
    return createStore().get(localeAtom)
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  // The atom used to default to "fr" whenever storage was empty, and the
  // SideDrawer effect pushes that value onto i18n — so a fresh device with an
  // English browser switched itself to French the moment the shell mounted,
  // which is the very complaint that opened this epic (#415).
  it("follows an English browser on a device that has stored nothing", async () => {
    await expect(localeFor("en-US")).resolves.toBe("en")
  })

  it("follows a French browser just the same", async () => {
    await expect(localeFor("fr-FR")).resolves.toBe("fr")
  })

  it("lands on English for a language the app does not speak", async () => {
    await expect(localeFor("de-DE")).resolves.toBe("en")
  })

  it("still lets a stored choice win over the browser", async () => {
    vi.resetModules()
    vi.stubGlobal("navigator", { language: "en-US" })
    localStorage.setItem("locale", '"fr"')
    const { localeAtom } = await import("./atoms")

    expect(createStore().get(localeAtom)).toBe("fr")
  })

  // A bare "fr" predates jotai's JSON encoding but is a preference the user
  // really expressed; jotai's default storage would read it as corrupt and use
  // the detected default instead, silently flipping them to English.
  it("honours a legacy raw value written by an older version", async () => {
    vi.resetModules()
    vi.stubGlobal("navigator", { language: "en-US" })
    localStorage.setItem("locale", "fr")
    const { localeAtom } = await import("./atoms")

    expect(createStore().get(localeAtom)).toBe("fr")
  })

  it("upgrades the encoding as soon as the value is written", async () => {
    vi.resetModules()
    vi.stubGlobal("navigator", { language: "en-US" })
    localStorage.setItem("locale", "fr")
    const { localeAtom } = await import("./atoms")

    createStore().set(localeAtom, "fr")

    expect(localStorage.getItem("locale")).toBe('"fr"')
  })

  it("ignores an unsupported stored value and detects instead", async () => {
    vi.resetModules()
    vi.stubGlobal("navigator", { language: "fr-FR" })
    localStorage.setItem("locale", '"es"')
    const { localeAtom } = await import("./atoms")

    expect(createStore().get(localeAtom)).toBe("fr")
  })
})
