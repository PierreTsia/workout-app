import { getDefaultStore } from "jotai"
import { groupBy } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { queryClient } from "@/lib/queryClient"
import {
  authAtom,
  sessionAtom,
  syncStatusAtom,
  queueSyncMetaAtom,
  activeProgramIdAtom,
  achievementUnlockQueueAtom,
  achievementShownIdsAtom,
  lastSessionBadgesAtom,
} from "@/store/atoms"
import type { UnlockedAchievement } from "@/types/achievements"
import type { WorkoutDay } from "@/types/database"

// ---------------------------------------------------------------------------
// Payload types (unchanged from stub)
// ---------------------------------------------------------------------------

/** Rep-based set log (existing behavior). */
export type SetLogPayloadReps = {
  sessionId: string
  exerciseId: string
  exerciseNameSnapshot: string
  setNumber: number
  repsLogged: string
  weightLogged: number
  estimatedOneRM: number
  wasPr: boolean
  loggedAt: number
  rir?: number
  restSeconds?: number | null
}

/** Time-based set log; mutually exclusive with reps fields at rest. */
export type SetLogPayloadDuration = {
  sessionId: string
  exerciseId: string
  exerciseNameSnapshot: string
  setNumber: number
  weightLogged: number
  loggedAt: number
  durationSeconds: number
  /** Omitted on legacy queued payloads — treated as false in `processSetLog`. */
  wasPr?: boolean
  restSeconds?: number | null
}

export type SetLogPayload = SetLogPayloadReps | SetLogPayloadDuration

export interface ProgressionTarget {
  workoutExerciseId: string
  reps: number
  weight: number
  sets: number
  /** When present, this is a duration exercise target — write target_duration_seconds, not reps. */
  targetDurationSeconds?: number
}

export function filterValidProgressionTargets(
  targets: ProgressionTarget[] | undefined,
): ProgressionTarget[] {
  return (targets ?? []).filter((t) => {
    if (isNaN(t.weight) || isNaN(t.sets) || t.sets <= 0) return false
    if (t.targetDurationSeconds != null) return t.targetDurationSeconds > 0
    return !isNaN(t.reps) && t.reps > 0
  })
}

export interface SessionFinishPayload {
  sessionId: string
  workoutDayId: string
  workoutLabelSnapshot: string
  startedAt: number
  finishedAt: number
  /** Non-negative milliseconds of active training (excludes pause). */
  activeDurationMs: number
  totalSetsDone: number
  hasSkippedSets: boolean
  cycleId?: string | null
  closeCycleOnComplete?: boolean
  progressionTargets?: ProgressionTarget[]
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface QueueItem {
  type: "set_log" | "session_finish"
  payload: SetLogPayload | SessionFinishPayload
  realSessionId: string
  queuedAt: number
  dedupeComposite: string
  fingerprint: string
}

interface SessionMeta {
  realId: string
  workoutDayId: string | null
  workoutLabelSnapshot: string
  startedAt: number
}

// ---------------------------------------------------------------------------
// Jotai store access (outside React)
// ---------------------------------------------------------------------------

const store = getDefaultStore()

function getUserId(): string | null {
  return store.get(authAtom)?.id ?? null
}

/** Deduplicate and push newly unlocked achievements into the overlay queue. */
export function pushAchievementsToQueue(items: UnlockedAchievement[]): void {
  const shown = store.get(achievementShownIdsAtom)
  const queue = store.get(achievementUnlockQueueAtom)
  const existingIds = new Set([
    ...shown,
    ...queue.map((a) => a.tier_id),
  ])
  const fresh = items.filter((a) => !existingIds.has(a.tier_id))
  if (fresh.length > 0) {
    store.set(achievementUnlockQueueAtom, [...queue, ...fresh])
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function queueKey(userId: string) {
  return `offlineQueue:${userId}`
}
function metaKey(userId: string) {
  return `sessionMeta:${userId}`
}
function cancelledKey(userId: string) {
  return `cancelledSessions:${userId}`
}

const CANCELLED_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CancelledEntry {
  realId: string
  ts: number
}

function getQueue(userId: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(queueKey(userId))
    return raw ? (JSON.parse(raw) as QueueItem[]) : []
  } catch {
    return []
  }
}

function setQueue(userId: string, items: QueueItem[]) {
  localStorage.setItem(queueKey(userId), JSON.stringify(items))
}

function getSessionMeta(
  userId: string,
): Record<string, SessionMeta> {
  try {
    const raw = localStorage.getItem(metaKey(userId))
    return raw
      ? (JSON.parse(raw) as Record<string, SessionMeta>)
      : {}
  } catch {
    return {}
  }
}

function setSessionMeta(
  userId: string,
  meta: Record<string, SessionMeta>,
) {
  localStorage.setItem(metaKey(userId), JSON.stringify(meta))
}

function getCancelledSessions(userId: string): CancelledEntry[] {
  try {
    const raw = localStorage.getItem(cancelledKey(userId))
    return raw ? (JSON.parse(raw) as CancelledEntry[]) : []
  } catch {
    return []
  }
}

function setCancelledSessions(
  userId: string,
  entries: CancelledEntry[],
) {
  localStorage.setItem(cancelledKey(userId), JSON.stringify(entries))
}

// ---------------------------------------------------------------------------
// Fingerprint — simple deterministic hash (not crypto-grade, just for dedupe)
// ---------------------------------------------------------------------------

function fingerprint(composite: string): string {
  let h = 0
  for (let i = 0; i < composite.length; i++) {
    h = ((h << 5) - h + composite.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

// ---------------------------------------------------------------------------
// Session-meta resolution
// ---------------------------------------------------------------------------

function resolveSessionMeta(
  userId: string,
  localSessionId: string,
): SessionMeta {
  const allMeta = getSessionMeta(userId)
  if (allMeta[localSessionId]) return allMeta[localSessionId]

  const session = store.get(sessionAtom)

  // Try to get the day label from TanStack Query cache
  let label = ""
  if (session.currentDayId) {
    const programId = store.get(activeProgramIdAtom)
    const days = queryClient.getQueryData<WorkoutDay[]>([
      "workout-days",
      userId,
      programId,
    ])
    label =
      days?.find((d) => d.id === session.currentDayId)?.label ?? ""
  }

  const meta: SessionMeta = {
    realId: crypto.randomUUID(),
    workoutDayId: session.currentDayId,
    workoutLabelSnapshot: label,
    startedAt: session.startedAt ?? Date.now(),
  }

  allMeta[localSessionId] = meta
  setSessionMeta(userId, allMeta)
  return meta
}

/** Stable UUID for the active workout; matches `realSessionId` used when enqueueing set logs. */
export function getSessionRealId(
  userId: string,
  localSessionId: string,
): string {
  return resolveSessionMeta(userId, localSessionId).realId
}

/**
 * Look up an existing `realSessionId` without creating one.
 * Returns null if the local session never produced any queued item.
 */
export function peekSessionRealId(
  userId: string,
  localSessionId: string,
): string | null {
  return getSessionMeta(userId)[localSessionId]?.realId ?? null
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

function updatePendingCount(userId: string) {
  const count = getQueue(userId).length
  store.set(queueSyncMetaAtom, (prev) => ({ ...prev, pendingCount: count }))
}

export function enqueueSetLog(payload: SetLogPayload): void {
  const userId = getUserId()
  if (!userId) {
    console.warn("[SyncService] enqueueSetLog called without auth")
    return
  }

  const meta = resolveSessionMeta(userId, payload.sessionId)
  const composite = `${meta.realId}|${payload.exerciseId}|${payload.setNumber}`

  const queue = getQueue(userId)
  const fp = fingerprint(composite)

  // Replace any existing queue item for the same (session, exercise, set)
  // so that uncheck → re-check overwrites with the latest values.
  const filtered = queue.filter((item) => item.fingerprint !== fp)

  const item: QueueItem = {
    type: "set_log",
    payload,
    realSessionId: meta.realId,
    queuedAt: Date.now(),
    dedupeComposite: composite,
    fingerprint: fp,
  }

  filtered.push(item)
  setQueue(userId, filtered)
  updatePendingCount(userId)
}

export function enqueueSessionFinish(
  payload: SessionFinishPayload,
): void {
  const userId = getUserId()
  if (!userId) {
    console.warn("[SyncService] enqueueSessionFinish called without auth")
    return
  }

  const meta = resolveSessionMeta(userId, payload.sessionId)

  // Enrich meta with finish-time data so drain has full info
  const allMeta = getSessionMeta(userId)
  allMeta[payload.sessionId] = {
    ...meta,
    workoutDayId: payload.workoutDayId || meta.workoutDayId,
    workoutLabelSnapshot:
      payload.workoutLabelSnapshot || meta.workoutLabelSnapshot,
    startedAt: payload.startedAt || meta.startedAt,
  }
  setSessionMeta(userId, allMeta)

  const composite = `${meta.realId}|session_finish`
  const fp = fingerprint(composite)

  const queue = getQueue(userId)
  if (queue.some((item) => item.fingerprint === fp)) return

  const item: QueueItem = {
    type: "session_finish",
    payload,
    realSessionId: meta.realId,
    queuedAt: Date.now(),
    dedupeComposite: composite,
    fingerprint: fp,
  }

  queue.push(item)
  setQueue(userId, queue)
  updatePendingCount(userId)
}

// ---------------------------------------------------------------------------
// Cancel session — deny-list + queue surgery
// ---------------------------------------------------------------------------

/**
 * Drop pending queue items for `realSessionId` and erase the matching
 * sessionMeta entry. Idempotent. Safe to call when the queue is empty
 * (no-op).
 */
export function discardSessionQueue(realSessionId: string): void {
  const userId = getUserId()
  if (!userId) return

  const queue = getQueue(userId)
  const surviving = queue.filter(
    (item) => item.realSessionId !== realSessionId,
  )
  if (surviving.length !== queue.length) {
    setQueue(userId, surviving)
    updatePendingCount(userId)
  }

  const allMeta = getSessionMeta(userId)
  const localKeys = Object.keys(allMeta).filter(
    (k) => allMeta[k].realId === realSessionId,
  )
  if (localKeys.length > 0) {
    const next = { ...allMeta }
    for (const k of localKeys) delete next[k]
    setSessionMeta(userId, next)
  }
}

/**
 * Mark a `realSessionId` as cancelled so any future drain skips it.
 * Survives reload — required to handle "cancel offline → reopen → drain".
 */
export function markSessionCancelled(realSessionId: string): void {
  const userId = getUserId()
  if (!userId) return

  const entries = pruneAndRead(userId)
  if (entries.some((e) => e.realId === realSessionId)) return
  entries.push({ realId: realSessionId, ts: Date.now() })
  setCancelledSessions(userId, entries)
}

/** Prune entries older than the TTL and return the live list. */
function pruneAndRead(userId: string): CancelledEntry[] {
  const entries = getCancelledSessions(userId)
  const cutoff = Date.now() - CANCELLED_TTL_MS
  const live = entries.filter((e) => e.ts >= cutoff)
  if (live.length !== entries.length) {
    setCancelledSessions(userId, live)
  }
  return live
}

/** Public wrapper for drain to call. Returns the active deny-list. */
export function pruneCancelledSessions(userId: string): Set<string> {
  return new Set(pruneAndRead(userId).map((e) => e.realId))
}

// ---------------------------------------------------------------------------
// Immediate drain (fire-and-forget, safe to call from event handlers)
// ---------------------------------------------------------------------------

export function scheduleImmediateDrain(): void {
  const userId = getUserId()
  if (userId && navigator.onLine) {
    drainQueue(userId)
  }
}

// ---------------------------------------------------------------------------
// Drain
// ---------------------------------------------------------------------------

/** Serializes drains so concurrent callers wait in line instead of no-op'ing (lost flush). */
let drainChain: Promise<void> = Promise.resolve()

async function drainQueueOnce(userId: string): Promise<void> {
  const cancelledIds = pruneCancelledSessions(userId)

  // Drop any queued items belonging to a cancelled session before draining.
  // Permanent removal — TTL handles deny-list cleanup.
  if (cancelledIds.size > 0) {
    const queueBefore = getQueue(userId)
    const filtered = queueBefore.filter(
      (item) => !cancelledIds.has(item.realSessionId),
    )
    if (filtered.length !== queueBefore.length) {
      setQueue(userId, filtered)
      updatePendingCount(userId)
    }
  }

  const queue = getQueue(userId)
  if (queue.length === 0) return

  store.set(syncStatusAtom, "syncing")

  const allMeta = getSessionMeta(userId)
  const exerciseIds = new Set<string>()
  const ensuredSessions = new Set<string>()

  const sessionGroups = groupBy(queue, (item) => item.realSessionId)

  const surviving: QueueItem[] = []

  for (const [realSessionId, items] of sessionGroups) {
    // --- Ensure session row exists ----------------------------------------
    if (!ensuredSessions.has(realSessionId)) {
      const sessionFinishItem = items.find(
        (i) => i.type === "session_finish",
      )
      const ok = await ensureSession(
        realSessionId,
        userId,
        allMeta,
        sessionFinishItem,
      )
      if (ok) {
        ensuredSessions.add(realSessionId)
      } else {
        // Can't create session → all items for this session survive
        surviving.push(...items)
        continue
      }
    }

    // --- Process individual items -----------------------------------------
    for (const item of items) {
      if (item.type === "set_log") {
        const p = item.payload as SetLogPayload
        exerciseIds.add(p.exerciseId)
        const ok = await processSetLog(item)
        if (!ok) surviving.push(item)
      } else {
        const ok = await processSessionFinish(item, userId)
        if (!ok) surviving.push(item)
      }
    }
  }

  // Re-read the queue to pick up any items that were enqueued while the
  // async drain was in progress (between the initial getQueue() snapshot and
  // now).  Without this, those newly-added items would be silently discarded
  // when we write back only the surviving (failed) items.
  const currentQueue = getQueue(userId)
  const snapshotFingerprints = new Set(queue.map((i) => i.fingerprint))
  const addedDuringDrain = currentQueue.filter(
    (item) => !snapshotFingerprints.has(item.fingerprint),
  )

  // Persist surviving (failed) items + items added during this drain run
  setQueue(userId, [...addedDuringDrain, ...surviving])
  updatePendingCount(userId)

  if (surviving.length === 0) {
    store.set(syncStatusAtom, "synced")
    store.set(queueSyncMetaAtom, (prev) => ({
      ...prev,
      lastSyncAt: Date.now(),
      pendingCount: 0,
    }))
    setTimeout(() => {
      if (store.get(syncStatusAtom) === "synced") {
        store.set(syncStatusAtom, "idle")
      }
    }, 3_000)
  } else {
    store.set(syncStatusAtom, "failed")
  }

  // Cache invalidation for all touched exercises
  for (const exId of exerciseIds) {
    queryClient.invalidateQueries({ queryKey: ["last-session", exId] })
    queryClient.invalidateQueries({ queryKey: ["last-session-detail", exId] })
    queryClient.invalidateQueries({ queryKey: ["best-1rm", exId] })
    queryClient.invalidateQueries({ queryKey: ["exercise-trend", exId] })
  }
  queryClient.invalidateQueries({ queryKey: ["sessions"] })
  queryClient.invalidateQueries({ queryKey: ["last-session-for-day"] })
  queryClient.invalidateQueries({ queryKey: ["progression-suggestions-for-day"] })
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "workout-exercises" })
  queryClient.invalidateQueries({ queryKey: ["pr-aggregates"] })
  queryClient.invalidateQueries({ queryKey: ["training-activity-by-day"] })
  queryClient.invalidateQueries({ queryKey: ["sessions-date-range"] })
  queryClient.invalidateQueries({ queryKey: ["active-cycle"] })
  queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
}

export function drainQueue(userId: string): Promise<void> {
  const task = drainChain.then(() => drainQueueOnce(userId))
  drainChain = task.catch((e) => {
    console.error("[SyncService] drainQueue failed", e)
  })
  return task
}

// ---------------------------------------------------------------------------
// Supabase operations
// ---------------------------------------------------------------------------

async function ensureSession(
  realSessionId: string,
  userId: string,
  allMeta: Record<string, SessionMeta>,
  sessionFinishItem: QueueItem | undefined,
): Promise<boolean> {
  try {
    // Find the matching SessionMeta (search by realId)
    const meta = Object.values(allMeta).find(
      (m) => m.realId === realSessionId,
    )

    if (sessionFinishItem) {
      const p = sessionFinishItem.payload as SessionFinishPayload
      const { error } = await supabase.from("sessions").upsert(
        {
          id: realSessionId,
          user_id: userId,
          workout_day_id: p.workoutDayId || null,
          workout_label_snapshot: p.workoutLabelSnapshot || "Workout",
          started_at: new Date(p.startedAt).toISOString(),
          finished_at: new Date(p.finishedAt).toISOString(),
          active_duration_ms: Math.max(0, Math.round(p.activeDurationMs)),
          total_sets_done: p.totalSetsDone,
          has_skipped_sets: p.hasSkippedSets,
          cycle_id: p.cycleId ?? null,
        },
        { onConflict: "id" },
      )
      if (error) {
        console.error("[SyncService] session upsert failed", error)
        return false
      }
    } else {
      // Partial session (mid-session drain — no finish yet)
      const { error } = await supabase.from("sessions").upsert(
        {
          id: realSessionId,
          user_id: userId,
          workout_day_id: meta?.workoutDayId ?? null,
          workout_label_snapshot:
            meta?.workoutLabelSnapshot || "Workout",
          started_at: new Date(
            meta?.startedAt ?? Date.now(),
          ).toISOString(),
          total_sets_done: 0,
          has_skipped_sets: false,
        },
        { onConflict: "id" },
      )
      if (error) {
        console.error("[SyncService] partial session upsert failed", error)
        return false
      }
    }
    return true
  } catch (e) {
    console.error("[SyncService] ensureSession error", e)
    return false
  }
}

async function processSetLog(item: QueueItem): Promise<boolean> {
  const p = item.payload as SetLogPayload
  try {
    const base = {
      session_id: item.realSessionId,
      exercise_id: p.exerciseId,
      exercise_name_snapshot: p.exerciseNameSnapshot,
      set_number: p.setNumber,
      weight_logged: p.weightLogged,
      logged_at: new Date(p.loggedAt).toISOString(),
    }

    // Avoid a union object type here: Supabase's upsert typing + excess-property
    // checking can choke on unions, even when each branch is individually valid.
    const isDuration = "durationSeconds" in p

    const row = {
      ...base,
      reps_logged: isDuration ? null : p.repsLogged,
      duration_seconds: isDuration ? p.durationSeconds : null,
      estimated_1rm: isDuration ? null : p.estimatedOneRM || null,
      was_pr: p.wasPr === true,
      rir: isDuration ? null : (p.rir ?? null),
      rest_seconds: p.restSeconds ?? null,
    }

    const { error } = await supabase
      .from("set_logs")
      .upsert(row, {
        onConflict: "session_id,exercise_id,set_number",
      })

    if (error) {
      console.error("[SyncService] set_log upsert failed", error)
      return false
    }
    return true
  } catch (e) {
    console.error("[SyncService] processSetLog error", e)
    return false
  }
}

async function processSessionFinish(
  item: QueueItem,
  userId: string,
): Promise<boolean> {
  const p = item.payload as SessionFinishPayload
  try {
    const { error } = await supabase.from("sessions").upsert(
      {
        id: item.realSessionId,
        user_id: userId,
        workout_day_id: p.workoutDayId || null,
        workout_label_snapshot: p.workoutLabelSnapshot || "Workout",
        started_at: new Date(p.startedAt).toISOString(),
        finished_at: new Date(p.finishedAt).toISOString(),
        active_duration_ms: Math.max(0, Math.round(p.activeDurationMs)),
        total_sets_done: p.totalSetsDone,
        has_skipped_sets: p.hasSkippedSets,
        cycle_id: p.cycleId ?? null,
      },
      { onConflict: "id" },
    )

    if (error) {
      console.error("[SyncService] session finish upsert failed", error)
      return false
    }

    const validTargets = filterValidProgressionTargets(p.progressionTargets)

    if (validTargets.length > 0) {
      const results = await Promise.all(
        validTargets.map((t) => {
          const shared = { weight: String(t.weight), sets: t.sets }
          const fields =
            t.targetDurationSeconds != null
              ? { ...shared, target_duration_seconds: t.targetDurationSeconds }
              : { ...shared, reps: String(t.reps) }
          return supabase
            .from("workout_exercises")
            .update(fields)
            .eq("id", t.workoutExerciseId)
        }),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        console.error("[SyncService] progression target update failed", failed.error)
        return false
      }
    }

    if (p.closeCycleOnComplete && p.cycleId) {
      // `.is("finished_at", null)` makes this a no-op when the cycle was
      // already closed (manual close, self-heal, or replay). Without it, a
      // retry or a later session_finish for the same cycle would clobber the
      // original `finished_at` with the current session's timestamp and shift
      // cycle_summary stats.
      const { error: cycleError } = await supabase
        .from("cycles")
        .update({ finished_at: new Date(p.finishedAt).toISOString() })
        .eq("id", p.cycleId)
        .eq("user_id", userId)
        .is("finished_at", null)

      if (cycleError) {
        console.error("[SyncService] cycle close update failed", cycleError)
        return false
      }
    }

    try {
      const { data, error } = await supabase.rpc("check_and_grant_achievements", {
        p_user_id: userId,
      })
      if (error) throw error
      const unlocked = (data ?? []) as UnlockedAchievement[]
      if (unlocked.length > 0) {
        pushAchievementsToQueue(unlocked)
        store.set(lastSessionBadgesAtom, unlocked)
      }
    } catch (e) {
      console.warn("[SyncService] badge check failed (non-critical)", e)
    }

    return true
  } catch (e) {
    console.error("[SyncService] processSessionFinish error", e)
    return false
  }
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------

let listenersInitialized = false

export function initSyncListeners(): void {
  if (listenersInitialized) return
  listenersInitialized = true

  window.addEventListener("online", () => {
    const userId = getUserId()
    if (userId) drainQueue(userId)
  })
}
