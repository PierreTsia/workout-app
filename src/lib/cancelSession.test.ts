import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// Atom markers
// ---------------------------------------------------------------------------

const AUTH_ATOM = Symbol("authAtom")
const SESSION_ATOM = Symbol("sessionAtom")
const REST_ATOM = Symbol("restAtom")
const IS_QUICK_WORKOUT_ATOM = Symbol("isQuickWorkoutAtom")
const PR_FLAGS_ATOM = Symbol("prFlagsAtom")
const SESSION_BEST_PERFORMANCE_ATOM = Symbol("sessionBestPerformanceAtom")

const DEFAULT_SESSION_STATE = {
  currentDayId: null,
  activeDayId: null,
  exerciseIndex: 0,
  setsData: {},
  startedAt: null,
  isActive: false,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
  cycleId: null,
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
}

interface DeleteChain {
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  then: ReturnType<typeof vi.fn>
}

function createDeleteChain(
  resolveWith: { data?: unknown; error?: unknown; count?: number | null } = {},
): DeleteChain {
  const chain: DeleteChain = {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    select: vi.fn(() => chain),
    then: vi.fn((resolve: (v: unknown) => void) =>
      resolve({
        data: resolveWith.data ?? null,
        error: resolveWith.error ?? null,
        count: resolveWith.count ?? null,
      }),
    ),
  }
  return chain
}

let sessionsChain: DeleteChain
let cyclesChain: DeleteChain

const mockFrom = vi.fn()
const mockSupabase = { from: mockFrom }

const mockQueryClient = {
  invalidateQueries: vi.fn(),
}

const mockClearPatchStorage = vi.fn()

const mockDiscardSessionQueue = vi.fn()
const mockMarkSessionCancelled = vi.fn()
const mockPeekSessionRealId = vi.fn<(userId: string, localSessionId: string) => string | null>()

vi.mock("jotai", () => ({
  getDefaultStore: () => mockStore,
}))

vi.mock("@/store/atoms", () => ({
  authAtom: AUTH_ATOM,
  sessionAtom: SESSION_ATOM,
  restAtom: REST_ATOM,
  isQuickWorkoutAtom: IS_QUICK_WORKOUT_ATOM,
  prFlagsAtom: PR_FLAGS_ATOM,
  sessionBestPerformanceAtom: SESSION_BEST_PERFORMANCE_ATOM,
  defaultSessionState: DEFAULT_SESSION_STATE,
}))

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}))

vi.mock("@/lib/queryClient", () => ({
  queryClient: mockQueryClient,
}))

vi.mock("@/lib/sessionExercisePatchStorage", () => ({
  clearSessionExercisePatchStorage: mockClearPatchStorage,
}))

vi.mock("@/lib/syncService", () => ({
  discardSessionQueue: mockDiscardSessionQueue,
  markSessionCancelled: mockMarkSessionCancelled,
  peekSessionRealId: mockPeekSessionRealId,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "user-123"
const REAL_ID = "real-session-uuid"
const STARTED_AT = 1_700_000_000_000
const LOCAL_ID = `local-${STARTED_AT}`

let cancelActiveSession: typeof import("./cancelSession").cancelActiveSession
let resetSessionAtoms: typeof import("./cancelSession").resetSessionAtoms

function setActiveSession(overrides: Record<string, unknown> = {}) {
  mockStore.get.mockImplementation((atom: unknown) => {
    if (atom === AUTH_ATOM) return { id: USER_ID }
    if (atom === SESSION_ATOM) {
      return {
        ...DEFAULT_SESSION_STATE,
        isActive: true,
        startedAt: STARTED_AT,
        currentDayId: "day-1",
        activeDayId: "day-1",
        cycleId: "cycle-1",
        ...overrides,
      }
    }
    return undefined
  })
}

// ---------------------------------------------------------------------------

describe("cancelSession", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    sessionsChain = createDeleteChain()
    cyclesChain = createDeleteChain()

    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") return sessionsChain
      if (table === "cycles") return cyclesChain
      return createDeleteChain()
    })

    mockPeekSessionRealId.mockReturnValue(REAL_ID)

    const mod = await import("./cancelSession")
    cancelActiveSession = mod.cancelActiveSession
    resetSessionAtoms = mod.resetSessionAtoms
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // =========================================================================
  // resetSessionAtoms
  // =========================================================================

  describe("resetSessionAtoms", () => {
    it("writes the default session state to sessionAtom", () => {
      resetSessionAtoms()

      const sessionSet = mockStore.set.mock.calls.find(
        ([atom]) => atom === SESSION_ATOM,
      )
      expect(sessionSet?.[1]).toBe(DEFAULT_SESSION_STATE)
    })

    it("clears restAtom and isQuickWorkoutAtom", () => {
      resetSessionAtoms()

      const restSet = mockStore.set.mock.calls.find(
        ([atom]) => atom === REST_ATOM,
      )
      const quickSet = mockStore.set.mock.calls.find(
        ([atom]) => atom === IS_QUICK_WORKOUT_ATOM,
      )

      expect(restSet?.[1]).toBeNull()
      expect(quickSet?.[1]).toBe(false)
    })

    it("clears the session-exercise-patch storage", () => {
      resetSessionAtoms()

      expect(mockClearPatchStorage).toHaveBeenCalledTimes(1)
    })

    /**
     * Regression #291 — `prFlagsAtom` and `sessionBestPerformanceAtom` were
     * promoted to `atomWithStorage` so PRs survive a mid-session refresh.
     * That persistence means `resetSessionAtoms` must explicitly wipe them
     * too, otherwise PR badges from a previous session would leak into the
     * next bilan after Cancel or "New Session".
     */
    it("clears prFlagsAtom and sessionBestPerformanceAtom (regression #291)", () => {
      resetSessionAtoms()

      const prFlagsSet = mockStore.set.mock.calls.find(
        ([atom]) => atom === PR_FLAGS_ATOM,
      )
      const sessionBestSet = mockStore.set.mock.calls.find(
        ([atom]) => atom === SESSION_BEST_PERFORMANCE_ATOM,
      )

      expect(prFlagsSet?.[1]).toEqual({})
      expect(sessionBestSet?.[1]).toEqual({})
    })
  })

  // =========================================================================
  // cancelActiveSession
  // =========================================================================

  describe("cancelActiveSession", () => {
    it("returns early when no session is active", async () => {
      mockStore.get.mockImplementation((atom: unknown) => {
        if (atom === AUTH_ATOM) return { id: USER_ID }
        if (atom === SESSION_ATOM) {
          return { ...DEFAULT_SESSION_STATE, isActive: false }
        }
        return undefined
      })

      await cancelActiveSession()

      expect(mockMarkSessionCancelled).not.toHaveBeenCalled()
      expect(mockDiscardSessionQueue).not.toHaveBeenCalled()
      expect(mockFrom).not.toHaveBeenCalled()
      expect(mockStore.set).not.toHaveBeenCalled()
    })

    it("returns early when session has no startedAt", async () => {
      mockStore.get.mockImplementation((atom: unknown) => {
        if (atom === AUTH_ATOM) return { id: USER_ID }
        if (atom === SESSION_ATOM) {
          return { ...DEFAULT_SESSION_STATE, isActive: true, startedAt: null }
        }
        return undefined
      })

      await cancelActiveSession()

      expect(mockStore.set).not.toHaveBeenCalled()
    })

    it("resets atoms even when no realSessionId exists (no set ever logged)", async () => {
      setActiveSession()
      mockPeekSessionRealId.mockReturnValue(null)

      await cancelActiveSession()

      expect(mockMarkSessionCancelled).not.toHaveBeenCalled()
      expect(mockDiscardSessionQueue).not.toHaveBeenCalled()
      expect(mockFrom).not.toHaveBeenCalled()
      // Atoms still get reset
      expect(
        mockStore.set.mock.calls.find(([atom]) => atom === SESSION_ATOM),
      ).toBeDefined()
    })

    it("marks the realSessionId before discarding the queue", async () => {
      setActiveSession()

      await cancelActiveSession()

      expect(mockMarkSessionCancelled).toHaveBeenCalledWith(REAL_ID)
      expect(mockDiscardSessionQueue).toHaveBeenCalledWith(REAL_ID)

      const markOrder = mockMarkSessionCancelled.mock.invocationCallOrder[0]
      const discardOrder = mockDiscardSessionQueue.mock.invocationCallOrder[0]
      expect(markOrder).toBeLessThan(discardOrder)
    })

    it("deletes the session row scoped by id and user_id", async () => {
      setActiveSession()

      await cancelActiveSession()

      expect(mockFrom).toHaveBeenCalledWith("sessions")
      expect(sessionsChain.delete).toHaveBeenCalledTimes(1)
      const eqCalls = sessionsChain.eq.mock.calls
      expect(eqCalls).toContainEqual(["id", REAL_ID])
      expect(eqCalls).toContainEqual(["user_id", USER_ID])
    })

    it("does not throw when Supabase delete fails", async () => {
      setActiveSession({ cycleId: null })
      sessionsChain = createDeleteChain({ error: { message: "network" } })
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionsChain
        return createDeleteChain()
      })

      vi.spyOn(console, "warn").mockImplementation(() => {})

      await expect(cancelActiveSession()).resolves.toBeUndefined()

      expect(
        mockStore.set.mock.calls.find(([atom]) => atom === SESSION_ATOM),
      ).toBeDefined()
    })

    it("attempts cycle cleanup only when sessions count is zero", async () => {
      setActiveSession()
      cyclesChain = createDeleteChain()
      sessionsChain = createDeleteChain({ count: 0 })
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionsChain
        if (table === "cycles") return cyclesChain
        return createDeleteChain()
      })

      await cancelActiveSession()

      expect(mockFrom).toHaveBeenCalledWith("cycles")
      expect(cyclesChain.delete).toHaveBeenCalledTimes(1)
      const cycleEqCalls = cyclesChain.eq.mock.calls
      expect(cycleEqCalls).toContainEqual(["id", "cycle-1"])
      expect(cycleEqCalls).toContainEqual(["user_id", USER_ID])
      expect(cyclesChain.is).toHaveBeenCalledWith("finished_at", null)
    })

    it("scopes the cycle session count by user_id (defense in depth)", async () => {
      setActiveSession()
      sessionsChain = createDeleteChain({ count: 0 })
      cyclesChain = createDeleteChain()
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionsChain
        if (table === "cycles") return cyclesChain
        return createDeleteChain()
      })

      await cancelActiveSession()

      const sessionEqCalls = sessionsChain.eq.mock.calls
      // First delete uses (id, user_id); count call uses (cycle_id, user_id).
      expect(sessionEqCalls).toContainEqual(["cycle_id", "cycle-1"])
      expect(sessionEqCalls.filter(([k]) => k === "user_id").length).toBeGreaterThanOrEqual(2)
    })

    it("skips cycle delete when sibling sessions still exist", async () => {
      setActiveSession()
      sessionsChain = createDeleteChain({ count: 2 })
      cyclesChain = createDeleteChain()
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionsChain
        if (table === "cycles") return cyclesChain
        return createDeleteChain()
      })

      await cancelActiveSession()

      expect(cyclesChain.delete).not.toHaveBeenCalled()
    })

    it("skips cycle cleanup entirely when the session delete failed", async () => {
      setActiveSession()
      sessionsChain = createDeleteChain({ error: { message: "boom" } })
      cyclesChain = createDeleteChain()
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionsChain
        if (table === "cycles") return cyclesChain
        return createDeleteChain()
      })
      vi.spyOn(console, "warn").mockImplementation(() => {})

      await cancelActiveSession()

      // Only one call to `from("sessions")` (the delete) — no count, no cycle delete.
      const sessionFroms = mockFrom.mock.calls.filter(([t]) => t === "sessions")
      expect(sessionFroms).toHaveLength(1)
      expect(cyclesChain.delete).not.toHaveBeenCalled()
    })

    it("skips cycle cleanup entirely when session has no cycleId", async () => {
      setActiveSession({ cycleId: null })

      await cancelActiveSession()

      expect(mockFrom).not.toHaveBeenCalledWith("cycles")
    })

    it("times out a hung Supabase delete and still resets atoms", async () => {
      setActiveSession()
      // Chain whose `then` is a noop → never resolves → forces the timeout race.
      const stuckChain: DeleteChain = {
        delete: vi.fn(() => stuckChain),
        eq: vi.fn(() => stuckChain),
        is: vi.fn(() => stuckChain),
        select: vi.fn(() => stuckChain),
        then: vi.fn(),
      }
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return stuckChain
        return createDeleteChain()
      })
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.useFakeTimers()

      try {
        const promise = cancelActiveSession()
        await vi.advanceTimersByTimeAsync(4_001)
        await promise

        expect(
          mockStore.set.mock.calls.find(([atom]) => atom === SESSION_ATOM),
        ).toBeDefined()
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalled()
        // No cycle cleanup attempts after a hung session delete.
        expect(mockFrom).not.toHaveBeenCalledWith("cycles")
      } finally {
        vi.useRealTimers()
      }
    })

    it("invalidates session/cycle React Query caches at the end", async () => {
      setActiveSession()

      await cancelActiveSession()

      const keys = mockQueryClient.invalidateQueries.mock.calls.map(
        (c: unknown[]) => (c[0] as { queryKey: string[] }).queryKey,
      )
      expect(keys).toContainEqual(["sessions"])
      expect(keys).toContainEqual(["sessions-date-range"])
      expect(keys).toContainEqual(["training-activity-by-day"])
      expect(keys).toContainEqual(["active-cycle"])
      expect(keys).toContainEqual(["cycle-sessions"])
    })

    it("derives localSessionId from session.startedAt", async () => {
      setActiveSession()

      await cancelActiveSession()

      expect(mockPeekSessionRealId).toHaveBeenCalledWith(USER_ID, LOCAL_ID)
    })

    it("preserves currentDayId after reset so the user lands on the same day", async () => {
      setActiveSession({ currentDayId: "day-mercredi" })

      await cancelActiveSession()

      const sessionWrites = mockStore.set.mock.calls.filter(
        ([atom]) => atom === SESSION_ATOM,
      )
      // Last write is the currentDayId restore
      const final = sessionWrites[sessionWrites.length - 1][1]
      expect(final).toEqual(
        expect.objectContaining({ currentDayId: "day-mercredi" }),
      )
    })

    it("does not write a currentDayId when there was none on the session", async () => {
      setActiveSession({ currentDayId: null })

      await cancelActiveSession()

      const sessionWrites = mockStore.set.mock.calls.filter(
        ([atom]) => atom === SESSION_ATOM,
      )
      // Only the initial reset write — no preservation step.
      expect(sessionWrites).toHaveLength(1)
      expect(sessionWrites[0][1]).toBe(DEFAULT_SESSION_STATE)
    })

    it("only resets atoms when there is no auth user (no server steps possible)", async () => {
      mockStore.get.mockImplementation((atom: unknown) => {
        if (atom === AUTH_ATOM) return null
        if (atom === SESSION_ATOM) {
          return {
            ...DEFAULT_SESSION_STATE,
            isActive: true,
            startedAt: STARTED_AT,
          }
        }
        return undefined
      })

      await cancelActiveSession()

      expect(mockFrom).not.toHaveBeenCalled()
      expect(mockMarkSessionCancelled).not.toHaveBeenCalled()
      expect(
        mockStore.set.mock.calls.find(([atom]) => atom === SESSION_ATOM),
      ).toBeDefined()
    })
  })
})
