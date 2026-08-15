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
    is: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    then: vi.fn((resolve: (v: unknown) => void) =>
      resolve({ data: resolveWith.data ?? null, error: resolveWith.error ?? null }),
    ),
  }
  return chain
}

let sessionsChain = createChain()
let setLogsChain = createChain()
let workoutExercisesChain = createChain()
let cyclesChain = createChain()
let blockRunsChain = createChain()

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

function makeBlockRunPayload(
  overrides: Partial<import("./syncService").BlockRunPayload> = {},
): import("./syncService").BlockRunPayload {
  return {
    sessionId: "local-session-1",
    blockId: "blk-1",
    startedAt: 5_000,
    finishedAt: null,
    mode: "amrap",
    capSeconds: 1200,
    templateFingerprint: "amrap|1200|ex-1:5:0",
    benchmarkCircuitId: null,
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
let discardSessionQueue: typeof import("./syncService").discardSessionQueue
let markSessionCancelled: typeof import("./syncService").markSessionCancelled
let pruneCancelledSessions: typeof import("./syncService").pruneCancelledSessions
let peekSessionRealId: typeof import("./syncService").peekSessionRealId
let enqueueBlockRun: typeof import("./syncService").enqueueBlockRun
let discardBlockRun: typeof import("./syncService").discardBlockRun
let queuedBlockRunFor: typeof import("./syncService").queuedBlockRunFor

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
    cyclesChain = createChain()
    blockRunsChain = createChain()

    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") return sessionsChain
      if (table === "set_logs") return setLogsChain
      if (table === "workout_exercises") return workoutExercisesChain
      if (table === "cycles") return cyclesChain
      if (table === "block_runs") return blockRunsChain
      return createChain()
    })

    const mod = await import("./syncService")
    enqueueSetLog = mod.enqueueSetLog
    enqueueSessionFinish = mod.enqueueSessionFinish
    drainQueue = mod.drainQueue
    scheduleImmediateDrain = mod.scheduleImmediateDrain
    discardSessionQueue = mod.discardSessionQueue
    markSessionCancelled = mod.markSessionCancelled
    pruneCancelledSessions = mod.pruneCancelledSessions
    peekSessionRealId = mod.peekSessionRealId
    enqueueBlockRun = mod.enqueueBlockRun
    discardBlockRun = mod.discardBlockRun
    queuedBlockRunFor = mod.queuedBlockRunFor
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

    it("dedupes block set logs by block_exercise_id, not catalog exercise_id", () => {
      // Same catalog exercise appears twice in a circuit (e.g. push-ups in two
      // slots). They share exercise_id but must NOT collapse into one log.
      enqueueSetLog(
        makeSetLogPayload({ exerciseId: "ex-1", blockExerciseId: "be-A", setNumber: 1 }),
      )
      enqueueSetLog(
        makeSetLogPayload({ exerciseId: "ex-1", blockExerciseId: "be-B", setNumber: 1 }),
      )

      const queue = readQueue()
      expect(queue).toHaveLength(2)
      expect(queue[0].dedupeComposite).toContain("be-A")
      expect(queue[1].dedupeComposite).toContain("be-B")
    })

    it("dedupes solo set logs by workout_exercise_id when two slots share a catalog exercise", () => {
      // #463 / ADR 0012: heavy + light rowing solos in one session must not
      // collapse — fingerprint mirrors log_slot COALESCE(be, we, ex).
      enqueueSetLog(
        makeSetLogPayload({
          exerciseId: "ex-rowing",
          workoutExerciseId: "slot-heavy",
          setNumber: 1,
        }),
      )
      enqueueSetLog(
        makeSetLogPayload({
          exerciseId: "ex-rowing",
          workoutExerciseId: "slot-light",
          setNumber: 1,
        }),
      )

      const queue = readQueue()
      expect(queue).toHaveLength(2)
      expect(queue[0].dedupeComposite).toContain("slot-heavy")
      expect(queue[1].dedupeComposite).toContain("slot-light")
    })

    it("replaces a block set log when the same block cell is re-logged", () => {
      enqueueSetLog(
        makeSetLogPayload({ blockExerciseId: "be-A", setNumber: 1, loggedAt: 1000 }),
      )
      enqueueSetLog(
        makeSetLogPayload({ blockExerciseId: "be-A", setNumber: 1, loggedAt: 5000 }),
      )

      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].payload.loggedAt).toBe(5000)
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

    it("upserts set_log with onConflict on the log_slot unique index", async () => {
      enqueueSetLog(makeSetLogPayload())

      await drainQueue(USER_ID)

      expect(setLogsChain.upsert).toHaveBeenCalledTimes(1)
      const [row, opts] = setLogsChain.upsert.mock.calls[0]
      expect(opts).toEqual({ onConflict: "session_id,log_slot,set_number" })
      expect(row).toEqual(expect.objectContaining({
        session_id: DETERMINISTIC_UUID,
        exercise_id: "ex-1",
        set_number: 1,
        block_exercise_id: null,
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
      enqueueSetLog(
        makeSetLogPayload({
          exerciseId: "ex-A",
          workoutExerciseId: "we-A",
        }),
      )
      enqueueSetLog(
        makeSetLogPayload({
          exerciseId: "ex-B",
          workoutExerciseId: "we-B",
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
      expect(keyMatches).toContainEqual(["last-session", "we-A"])
      expect(keyMatches).toContainEqual(["last-session-detail", "we-A"])
      expect(keyMatches).toContainEqual(["best-1rm", "ex-A"])
      expect(keyMatches).toContainEqual(["exercise-trend", "ex-A"])
      expect(keyMatches).toContainEqual(["last-session", "we-B"])
      expect(keyMatches).toContainEqual(["last-session-detail", "we-B"])
      expect(keyMatches).toContainEqual(["best-1rm", "ex-B"])
      expect(keyMatches).toContainEqual(["exercise-trend", "ex-B"])
      expect(keyMatches).toContainEqual(["last-weights-slots"])
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

    it("writes block_exercise_id to the set_logs upsert for block sets", async () => {
      enqueueSetLog(makeSetLogPayload({ blockExerciseId: "be-A" }))

      await drainQueue(USER_ID)

      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(
        expect.objectContaining({ block_exercise_id: "be-A" }),
      )
    })

    it("writes workout_exercise_id to the set_logs upsert for solo slots", async () => {
      enqueueSetLog(
        makeSetLogPayload({ workoutExerciseId: "slot-heavy" }),
      )

      await drainQueue(USER_ID)

      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(
        expect.objectContaining({
          workout_exercise_id: "slot-heavy",
          block_exercise_id: null,
        }),
      )
    })

    it("maps missing workoutExerciseId to null for legacy offline payloads", async () => {
      enqueueSetLog(makeSetLogPayload({ workoutExerciseId: undefined }))

      await drainQueue(USER_ID)

      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(
        expect.objectContaining({ workout_exercise_id: null }),
      )
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

    // Cycle 10: processSetLog writes the Prescription Snapshot columns when
    // the payload carries them. The engine reads these on subsequent sessions
    // to gate the snapshot vs Manual Override Window paths. See ADR 0006.
    it("writes prescribed_reps/weight/sets to set_logs upsert when present on reps payload", async () => {
      enqueueSetLog(
        makeSetLogPayload({
          repsLogged: "10",
          weightLogged: 50,
          prescribedReps: 10,
          prescribedWeight: 50,
          prescribedSets: 3,
        }),
      )

      await drainQueue(USER_ID)

      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(
        expect.objectContaining({
          prescribed_reps: 10,
          prescribed_weight: 50,
          prescribed_sets: 3,
          prescribed_duration_seconds: null,
        }),
      )
    })

    it("writes prescribed_duration_seconds + prescribed_sets when present on duration payload", async () => {
      enqueueSetLog({
        sessionId: "local-session-1",
        exerciseId: "ex-1",
        exerciseNameSnapshot: "Plank",
        setNumber: 1,
        weightLogged: 0,
        loggedAt: 1000,
        durationSeconds: 45,
        wasPr: false,
        prescribedDurationSeconds: 40,
        prescribedSets: 3,
        prescribedWeight: 0,
      })

      await drainQueue(USER_ID)

      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(
        expect.objectContaining({
          prescribed_reps: null,
          prescribed_weight: 0,
          prescribed_sets: 3,
          prescribed_duration_seconds: 40,
        }),
      )
    })

    it("legacy payload without prescribed_* fields writes NULLs", async () => {
      enqueueSetLog(makeSetLogPayload())

      await drainQueue(USER_ID)

      const upsertArg = setLogsChain.upsert.mock.calls[0][0]
      expect(upsertArg).toEqual(
        expect.objectContaining({
          prescribed_reps: null,
          prescribed_weight: null,
          prescribed_sets: null,
          prescribed_duration_seconds: null,
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

    // Cycle 11: the writeback that caused the bug at #373 must NEVER mutate
    // workout_exercises anymore — even when the queued payload still carries
    // legacy progressionTargets (e.g. offline queue items from before deploy).
    // See ADR 0006.
    it("never updates workout_exercises, even when legacy progressionTargets are present in the payload", async () => {
      // Cast through `unknown` because progressionTargets is no longer on the
      // type — simulating an offline queue item from a pre-deploy build.
      enqueueSessionFinish({
        ...makeSessionFinishPayload(),
        progressionTargets: [
          { workoutExerciseId: "we-1", reps: 11, weight: 50, sets: 3 },
          { workoutExerciseId: "we-2", reps: 8, weight: 80, sets: 4 },
        ],
      } as unknown as import("./syncService").SessionFinishPayload)

      await drainQueue(USER_ID)

      expect(workoutExercisesChain.update).not.toHaveBeenCalled()
    })

    it("auto-closes cycle when session_finish payload marks cycle completion", async () => {
      enqueueSessionFinish({
        ...makeSessionFinishPayload({ cycleId: "cycle-1" }),
        closeCycleOnComplete: true,
      } as import("./syncService").SessionFinishPayload)

      await drainQueue(USER_ID)

      expect(cyclesChain.update).toHaveBeenCalledWith({
        finished_at: expect.any(String),
      })
      expect(cyclesChain.eq).toHaveBeenCalledWith("id", "cycle-1")
      // RLS-defensive scoping: must also filter by the calling user.
      expect(cyclesChain.eq).toHaveBeenCalledWith("user_id", USER_ID)
      // Idempotency guard: re-running on an already-closed cycle is a no-op.
      expect(cyclesChain.is).toHaveBeenCalledWith("finished_at", null)
    })

    it("does not auto-close cycle when session_finish payload does not mark completion", async () => {
      enqueueSessionFinish(makeSessionFinishPayload({ cycleId: "cycle-1" }))

      await drainQueue(USER_ID)

      expect(cyclesChain.update).not.toHaveBeenCalled()
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
  // Cancel session — deny-list & queue surgery
  // =========================================================================

  describe("discardSessionQueue", () => {
    it("removes only items matching the realSessionId", () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))
      expect(readQueue()).toHaveLength(2)

      discardSessionQueue(DETERMINISTIC_UUID)

      expect(readQueue()).toHaveLength(0)
    })

    it("preserves items belonging to other sessions", () => {
      enqueueSetLog(makeSetLogPayload())

      const queueRaw = JSON.parse(
        localStorage.getItem(`offlineQueue:${USER_ID}`)!,
      )
      queueRaw.push({
        type: "set_log",
        payload: makeSetLogPayload({ setNumber: 9 }),
        realSessionId: "other-real-id",
        queuedAt: Date.now(),
        dedupeComposite: "other|x|9",
        fingerprint: "other-fp",
      })
      localStorage.setItem(
        `offlineQueue:${USER_ID}`,
        JSON.stringify(queueRaw),
      )

      discardSessionQueue(DETERMINISTIC_UUID)

      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].realSessionId).toBe("other-real-id")
    })

    it("erases the matching sessionMeta entry", () => {
      enqueueSetLog(makeSetLogPayload())
      expect(readSessionMeta()["local-session-1"]).toBeDefined()

      discardSessionQueue(DETERMINISTIC_UUID)

      expect(readSessionMeta()["local-session-1"]).toBeUndefined()
    })

    it("is a no-op when there is no auth", () => {
      enqueueSetLog(makeSetLogPayload())
      mockStore.get.mockImplementation((atom: unknown) => {
        if (atom === AUTH_ATOM) return null
        return undefined
      })

      discardSessionQueue(DETERMINISTIC_UUID)

      expect(readQueue()).toHaveLength(1)
    })

    it("updates queueSyncMeta pendingCount to reflect the new queue size", () => {
      enqueueSetLog(makeSetLogPayload())
      mockStore.set.mockClear()

      discardSessionQueue(DETERMINISTIC_UUID)

      const setCall = mockStore.set.mock.calls.find(
        ([atom]) => atom === QUEUE_SYNC_META_ATOM,
      )
      expect(setCall).toBeDefined()
    })
  })

  describe("markSessionCancelled + pruneCancelledSessions", () => {
    it("appends an entry the first time a session is marked", () => {
      vi.setSystemTime(new Date("2026-04-30T10:00:00Z"))

      markSessionCancelled("real-1")

      const live = pruneCancelledSessions(USER_ID)
      expect(live.has("real-1")).toBe(true)
    })

    it("is idempotent when called twice with the same id", () => {
      markSessionCancelled("real-1")
      markSessionCancelled("real-1")

      const raw = localStorage.getItem(`cancelledSessions:${USER_ID}`)
      expect(JSON.parse(raw!)).toHaveLength(1)
    })

    it("prunes entries older than the 7-day TTL", () => {
      const past = Date.now() - 8 * 24 * 60 * 60 * 1000
      const recent = Date.now() - 1 * 60 * 60 * 1000
      localStorage.setItem(
        `cancelledSessions:${USER_ID}`,
        JSON.stringify([
          { realId: "expired", ts: past },
          { realId: "fresh", ts: recent },
        ]),
      )

      const live = pruneCancelledSessions(USER_ID)

      expect(live.has("expired")).toBe(false)
      expect(live.has("fresh")).toBe(true)
    })
  })

  describe("drainQueue with deny-list", () => {
    it("drops queued items belonging to a cancelled session and never calls Supabase for them", async () => {
      enqueueSetLog(makeSetLogPayload({ setNumber: 1, loggedAt: 1000 }))
      enqueueSetLog(makeSetLogPayload({ setNumber: 2, loggedAt: 2000 }))
      markSessionCancelled(DETERMINISTIC_UUID)

      await drainQueue(USER_ID)

      expect(readQueue()).toHaveLength(0)
      expect(sessionsChain.upsert).not.toHaveBeenCalled()
      expect(setLogsChain.upsert).not.toHaveBeenCalled()
    })

    it("still drains items from non-cancelled sessions when deny-list contains a different id", async () => {
      enqueueSetLog(makeSetLogPayload())
      markSessionCancelled("some-other-real-id")

      await drainQueue(USER_ID)

      expect(setLogsChain.upsert).toHaveBeenCalledTimes(1)
      expect(readQueue()).toHaveLength(0)
    })
  })

  describe("enqueueBlockRun", () => {
    it("replaces started_at when GO is stamped again for the same block", () => {
      enqueueBlockRun(makeBlockRunPayload({ startedAt: 5_000 }))
      enqueueBlockRun(makeBlockRunPayload({ startedAt: 9_000 }))

      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].payload.startedAt).toBe(9_000)
    })

    it("ensures the session row before upserting block_runs on drain", async () => {
      enqueueBlockRun(makeBlockRunPayload())

      await drainQueue(USER_ID)

      expect(sessionsChain.upsert).toHaveBeenCalled()
      expect(blockRunsChain.upsert).toHaveBeenCalled()
      const sessionOrder = sessionsChain.upsert.mock.invocationCallOrder[0]
      const runOrder = blockRunsChain.upsert.mock.invocationCallOrder[0]
      expect(sessionOrder).toBeLessThan(runOrder)
      const [row, opts] = blockRunsChain.upsert.mock.calls[0]
      expect(opts).toEqual({ onConflict: "session_id,block_id" })
      expect(row).toEqual(
        expect.objectContaining({
          session_id: DETERMINISTIC_UUID,
          block_id: "blk-1",
          mode: "amrap",
          cap_seconds: 1200,
          finished_at: null,
        }),
      )
      expect(readQueue()).toHaveLength(0)
    })

    it("carries the catalog id offline and upserts it as benchmark_circuit_id", async () => {
      const cindyId = "11111111-1111-4111-8111-111111111111"
      enqueueBlockRun(makeBlockRunPayload({ benchmarkCircuitId: cindyId }))

      expect(queuedBlockRunFor("local-session-1", "blk-1")?.benchmarkCircuitId).toBe(
        cindyId,
      )

      await drainQueue(USER_ID)

      const [row] = blockRunsChain.upsert.mock.calls[0]
      expect(row).toEqual(
        expect.objectContaining({ benchmark_circuit_id: cindyId }),
      )
    })

    it("upserts null benchmark_circuit_id for a jetable queued run", async () => {
      enqueueBlockRun(makeBlockRunPayload({ benchmarkCircuitId: null }))

      await drainQueue(USER_ID)

      const [row] = blockRunsChain.upsert.mock.calls[0]
      expect(row).toEqual(
        expect.objectContaining({ benchmark_circuit_id: null }),
      )
    })

    it("mints session meta and queues a block_run before any set_log", () => {
      expect(peekSessionRealId(USER_ID, "local-session-1")).toBeNull()

      enqueueBlockRun(makeBlockRunPayload())

      expect(peekSessionRealId(USER_ID, "local-session-1")).toBe(
        DETERMINISTIC_UUID,
      )
      const queue = readQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].type).toBe("block_run")
      expect(queue[0].payload).toEqual(
        expect.objectContaining({
          blockId: "blk-1",
          startedAt: 5_000,
          finishedAt: null,
        }),
      )
      expect(queuedBlockRunFor("local-session-1", "blk-1")?.startedAt).toBe(
        5_000,
      )
    })
  })

  describe("discardBlockRun", () => {
    it("drops the queued Block Run and deletes the persisted row", async () => {
      enqueueBlockRun(makeBlockRunPayload())
      enqueueSetLog(
        makeSetLogPayload({ blockExerciseId: "be-A", setNumber: 1 }),
      )

      await discardBlockRun(DETERMINISTIC_UUID, "blk-1")

      const queue = readQueue()
      expect(
        queue.every((item: { type: string }) => item.type !== "block_run"),
      ).toBe(true)
      expect(queue).toHaveLength(1)
      expect(blockRunsChain.delete).toHaveBeenCalled()
      expect(blockRunsChain.eq).toHaveBeenCalledWith(
        "session_id",
        DETERMINISTIC_UUID,
      )
      expect(blockRunsChain.eq).toHaveBeenCalledWith("block_id", "blk-1")
    })
  })

  describe("peekSessionRealId", () => {
    it("returns null when there is no meta entry yet", () => {
      expect(peekSessionRealId(USER_ID, "local-session-1")).toBeNull()
    })

    it("returns the realId once the session has been seen by enqueueSetLog", () => {
      enqueueSetLog(makeSetLogPayload())

      expect(peekSessionRealId(USER_ID, "local-session-1")).toBe(
        DETERMINISTIC_UUID,
      )
    })
  })

})
