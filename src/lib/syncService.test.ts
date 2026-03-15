import { vi, describe, it, expect, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Atom markers — unique objects used as identity keys for store.get/set
// ---------------------------------------------------------------------------

const AUTH_ATOM = Symbol("authAtom")
const SESSION_ATOM = Symbol("sessionAtom")
const SYNC_STATUS_ATOM = Symbol("syncStatusAtom")
const QUEUE_SYNC_META_ATOM = Symbol("queueSyncMetaAtom")
const ACTIVE_PROGRAM_ID_ATOM = Symbol("activeProgramIdAtom")

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
    then: vi.fn((resolve: (v: unknown) => void) =>
      resolve({ data: resolveWith.data ?? null, error: resolveWith.error ?? null }),
    ),
  }
  return chain
}

let sessionsChain = createChain()
let setLogsSelectChain = createChain({ data: [] })
let setLogsInsertChain = createChain()

const mockFrom = vi.fn()

const mockSupabase = { from: mockFrom }

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
  overrides: Partial<import("./syncService").SetLogPayload> = {},
): import("./syncService").SetLogPayload {
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
      return undefined
    })
    mockStore.set.mockImplementation(() => {})

    mockQueryClient.getQueryData.mockReturnValue(undefined)

    // Fresh chains per test
    sessionsChain = createChain()
    setLogsSelectChain = createChain({ data: [] })
    setLogsInsertChain = createChain()

    let setLogsCallIndex = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") return sessionsChain
      if (table === "set_logs") {
        // First call = select (dedupe), second = insert
        const chain = setLogsCallIndex % 2 === 0 ? setLogsSelectChain : setLogsInsertChain
        setLogsCallIndex++
        return chain
      }
      return createChain()
    })

    const mod = await import("./syncService")
    enqueueSetLog = mod.enqueueSetLog
    enqueueSessionFinish = mod.enqueueSessionFinish
    drainQueue = mod.drainQueue
    scheduleImmediateDrain = mod.scheduleImmediateDrain
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
    it("drains 2 set_logs from the same session — upsert once, insert twice, queue empty", async () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))

      await drainQueue(USER_ID)

      expect(readQueue()).toHaveLength(0)
      // sessions.upsert called once for ensureSession
      expect(sessionsChain.upsert).toHaveBeenCalledTimes(1)
      // set_logs.insert called twice (one per set_log)
      expect(setLogsInsertChain.insert).toHaveBeenCalledTimes(2)
    })

    it("drains set_log + session_finish — session upserted with finish data", async () => {
      enqueueSetLog(makeSetLogPayload())
      enqueueSessionFinish(makeSessionFinishPayload())

      await drainQueue(USER_ID)

      expect(readQueue()).toHaveLength(0)
      // ensureSession sees the session_finish item and upserts with full data
      const upsertArg = sessionsChain.upsert.mock.calls[0]?.[0]
      expect(upsertArg).toEqual(
        expect.objectContaining({ finished_at: expect.any(String) }),
      )
    })

    it("keeps failed item in queue and sets syncStatus to failed on partial failure", async () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))

      // First set_log insert succeeds, second fails
      let insertCallIndex = 0
      setLogsInsertChain.then.mockImplementation(
        (resolve: (v: unknown) => void) => {
          insertCallIndex++
          if (insertCallIndex <= 1) {
            return resolve({ data: null, error: null })
          }
          return resolve({
            data: null,
            error: { message: "insert failed" },
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

    it("treats an existing row (server dedupe) as success and removes item", async () => {
      enqueueSetLog(makeSetLogPayload())

      // Select returns an existing row → dedupe
      setLogsSelectChain = createChain({ data: [{ id: "existing-row" }] })
      let setLogsCallIndex = 0
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionsChain
        if (table === "set_logs") {
          const chain =
            setLogsCallIndex % 2 === 0
              ? setLogsSelectChain
              : setLogsInsertChain
          setLogsCallIndex++
          return chain
        }
        return createChain()
      })

      await drainQueue(USER_ID)

      expect(readQueue()).toHaveLength(0)
      // insert should never have been called
      expect(setLogsInsertChain.insert).not.toHaveBeenCalled()
    })

    it("returns immediately on empty queue without calling Supabase", async () => {
      await drainQueue(USER_ID)

      expect(mockFrom).not.toHaveBeenCalled()
    })

    it("guards against re-entrant calls via the draining flag", async () => {
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

      // Second call should be a no-op and resolve immediately
      await second

      // Let the first one finish
      resolveUpsert({ data: null, error: null })
      // Also resolve the subsequent set_logs chains
      setLogsSelectChain.then.mockImplementation(
        (resolve: (v: unknown) => void) =>
          resolve({ data: [], error: null }),
      )
      setLogsInsertChain.then.mockImplementation(
        (resolve: (v: unknown) => void) =>
          resolve({ data: null, error: null }),
      )
      await first

      // sessions.upsert called only once (not twice)
      expect(sessionsChain.upsert).toHaveBeenCalledTimes(1)
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
        (c: unknown[]) => (c[0] as { queryKey: string[] }).queryKey,
      )
      expect(calls).toContainEqual(["sessions"])
      expect(calls).toContainEqual(["pr-aggregates"])
      expect(calls).toContainEqual(["last-session", "ex-A"])
      expect(calls).toContainEqual(["best-1rm", "ex-A"])
      expect(calls).toContainEqual(["exercise-trend", "ex-A"])
      expect(calls).toContainEqual(["last-session", "ex-B"])
      expect(calls).toContainEqual(["best-1rm", "ex-B"])
      expect(calls).toContainEqual(["exercise-trend", "ex-B"])
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

    it("passes rir value through to the set_logs insert", async () => {
      enqueueSetLog(makeSetLogPayload({ rir: 3 }))

      await drainQueue(USER_ID)

      expect(setLogsInsertChain.insert).toHaveBeenCalledTimes(1)
      const insertArg = setLogsInsertChain.insert.mock.calls[0][0]
      expect(insertArg).toEqual(expect.objectContaining({ rir: 3 }))
    })

    it("maps undefined rir to null for old payloads without rir field", async () => {
      enqueueSetLog(makeSetLogPayload({ rir: undefined }))

      await drainQueue(USER_ID)

      expect(setLogsInsertChain.insert).toHaveBeenCalledTimes(1)
      const insertArg = setLogsInsertChain.insert.mock.calls[0][0]
      expect(insertArg).toEqual(expect.objectContaining({ rir: null }))
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
})
