import { describe, expect, it, vi, beforeEach } from "vitest"
import { getDefaultStore } from "jotai"
import {
  sessionAtom,
  defaultSessionState,
  restAtom,
  syncStatusAtom,
  queueSyncMetaAtom,
  prFlagsAtom,
  sessionBest1RMAtom,
  isQuickWorkoutAtom,
  drawerOpenAtom,
  quickSheetOpenAtom,
  isAdminAtom,
  hasProgramAtom,
  activeProgramIdAtom,
} from "@/store/atoms"

const { mockClear } = vi.hoisted(() => ({ mockClear: vi.fn() }))

vi.mock("@/lib/queryClient", () => ({
  queryClient: { clear: mockClear },
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  }),
}))

vi.mock("@/lib/syncService", () => ({
  drainQueue: vi.fn(),
}))

import { clearUserState } from "@/lib/supabase"

const store = getDefaultStore()

function dirtyState() {
  store.set(sessionAtom, {
    ...defaultSessionState,
    currentDayId: "day-1",
    activeDayId: "day-1",
    startedAt: Date.now(),
    isActive: true,
    totalSetsDone: 5,
    setsData: {
      "ex-1": [{ kind: "reps", reps: "10", weight: "50", done: true }],
    },
  })
  store.set(restAtom, {
    startedAt: Date.now(),
    durationSeconds: 90,
    pausedAt: null,
    accumulatedPause: 0,
  })
  store.set(syncStatusAtom, "syncing")
  store.set(queueSyncMetaAtom, { pendingCount: 3 })
  store.set(prFlagsAtom, { "ex-1": true })
  store.set(sessionBest1RMAtom, { "ex-1": 100 })
  store.set(isQuickWorkoutAtom, true)
  store.set(drawerOpenAtom, true)
  store.set(quickSheetOpenAtom, true)
  store.set(isAdminAtom, true)
  store.set(hasProgramAtom, true)
  store.set(activeProgramIdAtom, "prog-1")

  localStorage.setItem("session-exercise-patch", JSON.stringify({ foo: 1 }))
}

describe("clearUserState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("resets all user-scoped atoms to defaults", () => {
    dirtyState()

    clearUserState()

    expect(store.get(sessionAtom)).toEqual(defaultSessionState)
    expect(store.get(restAtom)).toBeNull()
    expect(store.get(syncStatusAtom)).toBe("idle")
    expect(store.get(queueSyncMetaAtom)).toEqual({ pendingCount: 0 })
    expect(store.get(prFlagsAtom)).toEqual({})
    expect(store.get(sessionBest1RMAtom)).toEqual({})
    expect(store.get(isQuickWorkoutAtom)).toBe(false)
    expect(store.get(drawerOpenAtom)).toBe(false)
    expect(store.get(quickSheetOpenAtom)).toBe(false)
  })

  it("resets admin and program atoms", () => {
    dirtyState()

    clearUserState()

    expect(store.get(isAdminAtom)).toBe(false)
    expect(store.get(hasProgramAtom)).toBe(false)
    expect(store.get(activeProgramIdAtom)).toBeNull()
  })

  it("clears session-exercise-patch from localStorage", () => {
    dirtyState()
    expect(localStorage.getItem("session-exercise-patch")).not.toBeNull()

    clearUserState()

    expect(localStorage.getItem("session-exercise-patch")).toBeNull()
  })

  it("clears the React Query cache", () => {
    clearUserState()

    expect(mockClear).toHaveBeenCalledOnce()
  })

  it("preserves device preferences (locale, weightUnit, theme)", () => {
    localStorage.setItem("locale", '"en"')
    localStorage.setItem("weightUnit", '"lbs"')
    localStorage.setItem("workout-app-theme", "dark")

    clearUserState()

    expect(localStorage.getItem("locale")).toBe('"en"')
    expect(localStorage.getItem("weightUnit")).toBe('"lbs"')
    expect(localStorage.getItem("workout-app-theme")).toBe("dark")
  })
})
