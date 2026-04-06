import { vi, describe, it, expect, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Atom markers — unique objects used as identity keys for store.get/set
// ---------------------------------------------------------------------------

const AUTH_ATOM = Symbol("authAtom")
const SESSION_ATOM = Symbol("sessionAtom")
const SYNC_STATUS_ATOM = Symbol("syncStatusAtom")
const QUEUE_SYNC_META_ATOM = Symbol("queueSyncMetaAtom")
const ACTIVE_PROGRAM_ID_ATOM = Symbol("activeProgramIdAtom")
const ACHIEVEMENT_UNLOCK_QUEUE_ATOM = Symbol("achievementUnlockQueueAtom")
const ACHIEVEMENT_SHOWN_IDS_ATOM = Symbol("achievementShownIdsAtom")
const LAST_SESSION_BADGES_ATOM = Symbol("lastSessionBadgesAtom")

// ---------------------------------------------------------------------------
// Module-scope mock objects (survive vi.resetModules)
// ---------------------------------------------------------------------------

const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
}

function createChain(resolveWith: { data?: unknown; error?: unknown } = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then: ReturnType<typeof vi.fn>
  } = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    then: vi.fn((resolve: (v: unknown) => void) =>
      resolve({ data: resolveWith.data ?? null, error: resolveWith.error ?? null }),
    ),
  }
  return chain
}

let sessionsChain = createChain()
let setLogsChain = createChain()
let workoutExercisesChain = createChain()

const mockFrom = vi.fn()

const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
const mockSupabase = { from: mockFrom, rpc: mockRpc }

const mockQueryClient = {
  invalidateQueries: vi.fn(),
  getQueryData: vi.fn(),
}

// ---------------------------------------------------------------------------
// Hoisted mocks — intercept before any dynamic import
// ---------------------------------------------------------------------------

vi.mock("jotai", () => ({
  getDefaultStore: () => mockStore,
}))

vi.mock("@/store/atoms", () => ({
  authAtom: AUTH_ATOM,
  sessionAtom: SESSION_ATOM,
  syncStatusAtom: SYNC_STATUS_ATOM,
  queueSyncMetaAtom: QUEUE_SYNC_META_ATOM,
  activeProgramIdAtom: ACTIVE_PROGRAM_ID_ATOM,
  achievementUnlockQueueAtom: ACHIEVEMENT_UNLOCK_QUEUE_ATOM,
  achievementShownIdsAtom: ACHIEVEMENT_SHOWN_IDS_ATOM,
  lastSessionBadgesAtom: LAST_SESSION_BADGES_ATOM,
}))

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}))

vi.mock("@/lib/queryClient", () => ({
  queryClient: mockQueryClient,
}))

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const USER_ID = "user-123"
const DETERMINISTIC_UUID = "det-uuid-1"

function makeSetLogPayload(
  overrides: Partial<import("./syncService").SetLogPayloadReps> = {},
): import("./syncService").SetLogPayloadReps {
  return {
    sessionId: "local-session-1",
    exerciseId: "ex-1",
    exerciseNameSnapshot: "Bench Press",
    setNumber: 1,
    repsLogged: "10",
    weightLogged: 100,
    estimatedOneRM: 133,
    wasPr: false,
    loggedAt: 1000,
    rir: 3,
    ...overrides,
  }
}

function makeSessionFinishPayload(
  overrides: Partial<import("./syncService").SessionFinishPayload> = {},
): import("./syncService").SessionFinishPayload {
  return {
    sessionId: "local-session-1",
    workoutDayId: "day-1",
    workoutLabelSnapshot: "Push Day",
    startedAt: 1000,
    finishedAt: 2000,
    activeDurationMs: 1000,
    totalSetsDone: 5,
    hasSkippedSets: false,
    ...overrides,
  }
}

function readQueue() {
  const raw = localStorage.getItem(`offlineQueue:${USER_ID}`)
  return raw ? JSON.parse(raw) : []
}

function readSessionMeta() {
  const raw = localStorage.getItem(`sessionMeta:${USER_ID}`)
  return raw ? JSON.parse(raw) : {}
}

// ---------------------------------------------------------------------------
// Module-under-test bindings (reassigned after each dynamic import)
// ---------------------------------------------------------------------------

let enqueueSetLog: typeof import("./syncService").enqueueSetLog
let enqueueSessionFinish: typeof import("./syncService").enqueueSessionFinish
let drainQueue: typeof import("./syncService").drainQueue
let scheduleImmediateDrain: typeof import("./syncService").scheduleImmediateDrain
let filterValidProgressionTargets: typeof import("./syncService").filterValidProgressionTargets

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("SyncService", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    vi.useFakeTimers()

    // Deterministic UUID
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => DETERMINISTIC_UUID),
    })

    // Default mock store behaviour — authenticated user with active session
    mockStore.get.mockImplementation((atom: unknown) => {
      if (atom === AUTH_ATOM) return { id: USER_ID }
      if (atom === SESSION_ATOM)
        return {
          currentDayId: "day-1",
          exerciseIndex: 0,
          setsData: {},
          startedAt: 1000,
          isActive: true,
          totalSetsDone: 0,
        }
      if (atom === SYNC_STATUS_ATOM) return "idle"
      if (atom === ACTIVE_PROGRAM_ID_ATOM) return "program-1"
      if (atom === ACHIEVEMENT_UNLOCK_QUEUE_ATOM) return []
      if (atom === ACHIEVEMENT_SHOWN_IDS_ATOM) return new Set()
      if (atom === LAST_SESSION_BADGES_ATOM) return []
      return undefined
    })
    mockStore.set.mockImplementation(() => {})

    mockQueryClient.getQueryData.mockReturnValue(undefined)

    // Fresh chains per test
    sessionsChain = createChain()
    setLogsChain = createChain()
    workoutExercisesChain = createChain()

    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") return sessionsChain
      if (table === "set_logs") return setLogsChain
      if (table === "workout_exercises") return workoutExercisesChain
      return createChain()
    })

    const mod = await import("./syncService")
    enqueueSetLog = mod.enqueueSetLog
    enqueueSessionFinish = mod.enqueueSessionFinish
    drainQueue = mod.drainQueue
    scheduleImmediateDrain = mod.scheduleImmediateDrain
    filterValidProgressionTargets = mod.filterValidProgressionTargets
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // =========================================================================
  // enqueueSetLog
  // =========================================================================

  describe("enqueueSetLog", () => {
    it("enqueues item with correct type, fingerprint and dedupeComposite", () => {
      enqueueSetLog(makeSetLogPayload())

      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].type).toBe("set_log")
      expect(queue[0].fingerprint).toBeTruthy()
      expect(queue[0].dedupeComposite).toContain(DETERMINISTIC_UUID)
      expect(queue[0].dedupeComposite).toContain("ex-1")
    })

    it("deduplicates when the same composite is enqueued twice", () => {
      const payload = makeSetLogPayload()
      enqueueSetLog(payload)
      enqueueSetLog(payload)

      expect(readQueue()).toHaveLength(1)
    })

    it("warns and skips when there is no auth", () => {
      mockStore.get.mockImplementation((atom: unknown) => {
        if (atom === AUTH_ATOM) return null
        return undefined
      })
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      enqueueSetLog(makeSetLogPayload())

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("without auth"),
      )
      expect(readQueue()).toHaveLength(0)
    })

    it("enqueues two different sets independently", () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))

      expect(readQueue()).toHaveLength(2)
    })

    it("replaces existing queue item when the same set is re-logged (toggle fix)", () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000, rir: 2 }))
      expect(readQueue()).toHaveLength(1)

      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 5000, rir: 1 }))

      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].payload.loggedAt).toBe(5000)
      expect(queue[0].payload.rir).toBe(1)
    })

    it("updates queueSyncMetaAtom pendingCount after enqueue", () => {
      enqueueSetLog(makeSetLogPayload())

      const setCall = mockStore.set.mock.calls.find(
        ([atom]) => atom === QUEUE_SYNC_META_ATOM,
      )
      expect(setCall).toBeDefined()
      // The updater function receives prev and returns new
      const updater = setCall![1] as (prev: { pendingCount: number }) => {
        pendingCount: number
      }
      expect(updater({ pendingCount: 0 })).toEqual(
        expect.objectContaining({ pendingCount: 1 }),
      )
    })
  })

  // =========================================================================
  // enqueueSessionFinish
  // =========================================================================

  describe("enqueueSessionFinish", () => {
    it("enqueues item with type session_finish", () => {
      enqueueSessionFinish(makeSessionFinishPayload())

      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].type).toBe("session_finish")
    })

    it("deduplicates a duplicate session_finish", () => {
      const payload = makeSessionFinishPayload()
      enqueueSessionFinish(payload)
      enqueueSessionFinish(payload)

      expect(readQueue()).toHaveLength(1)
    })

    it("enriches sessionMeta with finish-time data", () => {
      enqueueSessionFinish(
        makeSessionFinishPayload({
          workoutDayId: "day-2",
          workoutLabelSnapshot: "Pull Day",
          startedAt: 500,
        }),
      )

      const meta = readSessionMeta()
      const entry = meta["local-session-1"]
      expect(entry).toBeDefined()
      expect(entry.workoutDayId).toBe("day-2")
      expect(entry.workoutLabelSnapshot).toBe("Pull Day")
      expect(entry.startedAt).toBe(500)
    })
  })

  // =========================================================================
  // drainQueue
  // =========================================================================

  describe("drainQueue", () => {
    it("drains 2 set_logs from the same session — session upsert once, set_logs upsert twice, queue empty", async () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))

      await drainQueue(USER_ID)

      expect(readQueue()).toHaveLength(0)
      expect(sessionsChain.upsert).toHaveBeenCalledTimes(1)
      expect(setLogsChain.upsert).toHaveBeenCalledTimes(2)
    })

    it("drains set_log + session_finish — session upserted with finish data", async () => {
      enqueueSetLog(makeSetLogPayload())
      enqueueSessionFinish(makeSessionFinishPayload())

      await drainQueue(USER_ID)

      expect(readQueue()).toHaveLength(0)
      // ensureSession sees the session_finish item and upserts with full data
      const upsertArg = sessionsChain.upsert.mock.calls[0]?.[0]
      expect(upsertArg).toEqual(
        expect.objectContaining({
          finished_at: expect.any(String),
          active_duration_ms: 1000,
        }),
      )
    })

    it("keeps failed item in queue and sets syncStatus to failed on partial failure", async () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))

      // First set_log upsert succeeds, second fails
      let upsertCallIndex = 0
      setLogsChain.then.mockImplementation(
        (resolve: (v: unknown) => void) => {
          upsertCallIndex++
          if (upsertCallIndex <= 1) {
            return resolve({ data: null, error: null })
          }
          return resolve({
            data: null,
            error: { message: "upsert failed" },
          })
        },
      )

      vi.spyOn(console, "error").mockImplementation(() => {})
      await drainQueue(USER_ID)

      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].payload.setNumber).toBe(2)

      const failCall = mockStore.set.mock.calls.find(
        ([atom, val]) =>
          atom === SYNC_STATUS_ATOM && val === "failed",
      )
      expect(failCall).toBeDefined()
    })

    it("upserts set_log with onConflict on the unique constraint", async () => {
      enqueueSetLog(makeSetLogPayload())

      await drainQueue(USER_ID)

      expect(setLogsChain.upsert).toHaveBeenCalledTimes(1)
      const [row, opts] = setLogsChain.upsert.mock.calls[0]
      expect(opts).toEqual({ onConflict: "session_id,exercise_id,set_number" })
      expect(row).toEqual(expect.objectContaining({
        session_id: DETERMINISTIC_UUID,
        exercise_id: "ex-1",
        set_number: 1,
      }))
    })

    it("returns immediately on empty queue without calling Supabase", async () => {
      await drainQueue(USER_ID)

      expect(mockFrom).not.toHaveBeenCalled()
    })

    it("serializes concurrent drainQueue calls (second waits for first)", async () => {
      vi.useRealTimers()
      enqueueSetLog(makeSetLogPayload())

      // Make the first drain hang by never resolving the upsert
      let resolveUpsert!: (v: unknown) => void
      sessionsChain.then.mockImplementation(
        (resolve: (v: unknown) => void) => {
          resolveUpsert = resolve
        },
      )

      const first = drainQueue(USER_ID)
      const second = drainQueue(USER_ID)

      let secondResolved = false
      const secondDone = second.then(() => {
        secondResolved = true
      })

      await new Promise((r) => setTimeout(r, 0))
      expect(secondResolved).toBe(false)

      resolveUpsert({ data: null, error: null })
      setLogsChain.then.mockImplementation(
        (resolve: (v: unknown) => void) =>
          resolve({ data: null, error: null }),
      )
      await Promise.all([first, secondDone])

      expect(sessionsChain.upsert).toHaveBeenCalledTimes(1)
    })

    it("preserves items enqueued during an in-flight drain (race condition fix)", async () => {
      vi.useRealTimers()

      // Enqueue set 1 so there is something to drain
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))

      // Capture the resolve callback so we can pause the drain mid-flight
      let resolveSessionUpsertCallback!: (v: unknown) => void
      sessionsChain.then.mockImplementation((resolve: (v: unknown) => void) => {
        resolveSessionUpsertCallback = resolve
      })

      // Start the drain — it will stall waiting for the session upsert
      const drainPromise = drainQueue(USER_ID)

      // Yield to let drainQueueOnce reach the awaited session upsert
      await new Promise((r) => setTimeout(r, 0))

      // Simulate the user logging a new set WHILE the drain is in-flight
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))

      // Now let the session upsert resolve and allow set_log upserts to succeed
      resolveSessionUpsertCallback({ data: null, error: null })
      setLogsChain.then.mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null }),
      )

      await drainPromise

      // Set 2 was enqueued after the drain started — it must still be in the
      // queue so a subsequent drain can process it (not silently dropped).
      expect(readQueue()).toHaveLength(1)
      expect(readQueue()[0].payload.setNumber).toBe(2)
    })

    it("invalidates caches for sessions, pr-aggregates, and per-exercise keys", async () => {
      enqueueSetLog(makeSetLogPayload({ exerciseId: "ex-A" }))
      enqueueSetLog(
        makeSetLogPayload({
          exerciseId: "ex-B",
          setNumber: 2,
          loggedAt: 3000,
        }),
      )

      await drainQueue(USER_ID)

      const calls = mockQueryClient.invalidateQueries.mock.calls.map(
        (c: unknown[]) => (c[0] as { queryKey?: string[]; predicate?: unknown }),
      )
      const keyMatches = calls.filter((c) => c.queryKey).map((c) => c.queryKey)
      expect(keyMatches).toContainEqual(["sessions"])
      expect(keyMatches).toContainEqual(["last-session-for-day"])
      expect(keyMatches).toContainEqual(["pr-aggregates"])
      expect(keyMatches).toContainEqual(["training-activity-by-day"])
      expect(keyMatches).toContainEqual(["sessions-date-range"])
      expect(keyMatches).toContainEqual(["last-session", "ex-A"])
      expect(keyMatches).toContainEqual(["last-session-detail", "ex-A"])
      expect(keyMatches).toContainEqual(["best-1rm", "ex-A"])
      expect(keyMatches).toContainEqual(["exercise-trend", "ex-A"])
      expect(keyMatches).toContainEqual(["last-session", "ex-B"])
      expect(keyMatches).toContainEqual(["last-session-detail", "ex-B"])
      expect(keyMatches).toContainEqual(["best-1rm", "ex-B"])
      expect(keyMatches).toContainEqual(["exercise-trend", "ex-B"])
    })

    it("transitions syncStatusAtom through syncing → synced (all drained) or syncing → failed", async () => {
      enqueueSetLog(makeSetLogPayload())

      await drainQueue(USER_ID)

      const statusCalls = mockStore.set.mock.calls
        .filter(([atom]) => atom === SYNC_STATUS_ATOM)
        .map(([, val]) => val)

      expect(statusCalls[0]).toBe("syncing")
      expect(statusCalls[1]).toBe("synced")
    })

    it("passes rir value through to the set_logs upsert", async () => {
      enqueueSetLog(makeSetLogPayload({ rir: 3 }))

      await drainQueue(USER_ID)

      expect(setLogsChain.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(expect.objectContaining({ rir: 3 }))
    })

    it("maps undefined rir to null for old payloads without rir field", async () => {
      enqueueSetLog(makeSetLogPayload({ rir: undefined }))

      await drainQueue(USER_ID)

      expect(setLogsChain.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(expect.objectContaining({ rir: null }))
    })

    it("upserts duration set with null reps and null estimated_1rm", async () => {
      enqueueSetLog({
        sessionId: "local-session-1",
        exerciseId: "ex-1",
        exerciseNameSnapshot: "Plank",
        setNumber: 1,
        weightLogged: 0,
        loggedAt: 1000,
        durationSeconds: 45,
        wasPr: false,
      })

      await drainQueue(USER_ID)

      expect(setLogsChain.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(
        expect.objectContaining({
          reps_logged: null,
          duration_seconds: 45,
          estimated_1rm: null,
          was_pr: false,
          rir: null,
        }),
      )
    })

    it("includes rest_seconds in upsert row when provided", async () => {
      enqueueSetLog(makeSetLogPayload({ restSeconds: 85 }))

      await drainQueue(USER_ID)

      expect(setLogsChain.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(expect.objectContaining({ rest_seconds: 85 }))
    })

    it("maps undefined restSeconds to null", async () => {
      enqueueSetLog(makeSetLogPayload())

      await drainQueue(USER_ID)

      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(expect.objectContaining({ rest_seconds: null }))
    })

    it("calls check_and_grant_achievements RPC after session finish", async () => {
      enqueueSessionFinish(makeSessionFinishPayload())

      await drainQueue(USER_ID)

      expect(mockRpc).toHaveBeenCalledWith("check_and_grant_achievements", {
        p_user_id: USER_ID,
      })
    })

    it("returns true even when achievement RPC fails", async () => {
      mockRpc.mockRejectedValueOnce(new Error("RPC failed"))
      vi.spyOn(console, "error").mockImplementation(() => {})

      enqueueSessionFinish(makeSessionFinishPayload())

      await drainQueue(USER_ID)

      expect(readQueue()).toHaveLength(0)
    })

    it("pushes RPC response into achievement queue and lastSessionBadgesAtom", async () => {
      const mockBadges = [
        {
          tier_id: "tier-1",
          group_slug: "consistency_streak",
          rank: "bronze",
          title_en: "The Sore Apprentice",
          title_fr: "Apprenti Courbaturé",
          icon_asset_url: null,
        },
      ]
      mockRpc.mockResolvedValueOnce({ data: mockBadges, error: null })

      enqueueSessionFinish(makeSessionFinishPayload())

      await drainQueue(USER_ID)

      const queueSetCall = mockStore.set.mock.calls.find(
        ([atom]) => atom === ACHIEVEMENT_UNLOCK_QUEUE_ATOM,
      )
      expect(queueSetCall).toBeDefined()

      const badgesSetCall = mockStore.set.mock.calls.find(
        ([atom]) => atom === LAST_SESSION_BADGES_ATOM,
      )
      expect(badgesSetCall).toBeDefined()
    })

    it("does not call RPC when session upsert fails", async () => {
      sessionsChain.then.mockImplementation(
        (resolve: (v: unknown) => void) =>
          resolve({ data: null, error: { message: "upsert failed" } }),
      )
      vi.spyOn(console, "error").mockImplementation(() => {})

      enqueueSessionFinish(makeSessionFinishPayload())

      await drainQueue(USER_ID)

      expect(mockRpc).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // scheduleImmediateDrain (#48)
  // =========================================================================

  describe("scheduleImmediateDrain", () => {
    it("triggers drainQueue when user is authenticated and online", async () => {
      vi.stubGlobal("navigator", { onLine: true })
      enqueueSetLog(makeSetLogPayload())

      scheduleImmediateDrain()

      // Give the drain a tick to start processing
      await vi.advanceTimersByTimeAsync(0)

      expect(readQueue()).toHaveLength(0)
    })

    it("does not drain when offline", () => {
      vi.stubGlobal("navigator", { onLine: false })
      enqueueSetLog(makeSetLogPayload())

      scheduleImmediateDrain()

      expect(readQueue()).toHaveLength(1)
    })

    it("does not drain when no user is authenticated", () => {
      vi.stubGlobal("navigator", { onLine: true })
      mockStore.get.mockImplementation((atom: unknown) => {
        if (atom === AUTH_ATOM) return null
        return undefined
      })

      // Can't enqueue without auth, so manually place an item
      localStorage.setItem(
        `offlineQueue:${USER_ID}`,
        JSON.stringify([{ type: "set_log", fingerprint: "test" }]),
      )

      scheduleImmediateDrain()

      // Queue should remain untouched — no userId means no drain
      const queue = readQueue()
      expect(queue).toHaveLength(1)
    })
  })

  // =========================================================================
  // filterValidProgressionTargets
  // =========================================================================

  describe("filterValidProgressionTargets", () => {
    function makeTarget(
      overrides: Partial<import("./syncService").ProgressionTarget> = {},
    ): import("./syncService").ProgressionTarget {
      return {
        workoutExerciseId: "we-1",
        reps: 10,
        weight: 80,
        sets: 3,
        ...overrides,
      }
    }

    it("returns empty array when targets is undefined", () => {
      expect(filterValidProgressionTargets(undefined)).toEqual([])
    })

    it("returns empty array when targets is empty", () => {
      expect(filterValidProgressionTargets([])).toEqual([])
    })

    it("keeps a fully valid target", () => {
      const targets = [makeTarget()]
      expect(filterValidProgressionTargets(targets)).toHaveLength(1)
    })

    it("drops target with NaN reps", () => {
      expect(filterValidProgressionTargets([makeTarget({ reps: NaN })])).toEqual([])
    })

    it("drops target with NaN weight", () => {
      expect(filterValidProgressionTargets([makeTarget({ weight: NaN })])).toEqual([])
    })

    it("drops target with NaN sets", () => {
      expect(filterValidProgressionTargets([makeTarget({ sets: NaN })])).toEqual([])
    })

    it("drops target with zero reps", () => {
      expect(filterValidProgressionTargets([makeTarget({ reps: 0 })])).toEqual([])
    })

    it("drops target with zero sets", () => {
      expect(filterValidProgressionTargets([makeTarget({ sets: 0 })])).toEqual([])
    })

    it("keeps target with zero weight (bodyweight exercise)", () => {
      const targets = [makeTarget({ weight: 0 })]
      expect(filterValidProgressionTargets(targets)).toHaveLength(1)
    })

    it("filters mixed valid and invalid targets", () => {
      const targets = [
        makeTarget({ reps: 10 }),
        makeTarget({ reps: NaN }),
        makeTarget({ sets: 0 }),
      ]
      const result = filterValidProgressionTargets(targets)
      expect(result).toHaveLength(1)
      expect(result[0].reps).toBe(10)
    })
  })
})
