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
import { grantAchievementsForUser } from "@/lib/grantAchievements"
import type { UnlockedAchievement } from "@/types/achievements"
import type { WorkoutDay } from "@/types/database"
import type { DeviationKind, DeviationPayload } from "@/lib/deviationCapture"

// ---------------------------------------------------------------------------
// Payload types (unchanged from stub)
// ---------------------------------------------------------------------------

/** Rep-based set log (existing behavior). */
export type SetLogPayloadReps = {
  sessionId: string
  exerciseId: string
  /**
   * Set when this log belongs to an Exercise Block cell (#351). Disambiguates
   * the same catalog exercise appearing in multiple slots; feeds the
   * `log_slot = COALESCE(block_exercise_id, workout_exercise_id, exercise_id)`
   * dedupe key.
   */
  blockExerciseId?: string | null
  /**
   * Solo **Exercise Slot** id (`workout_exercises.id`). Required for #463
   * slot-scoped Last Performance; left unset/null on block logs and legacy
   * offline queue items. Feeds `log_slot` after `blockExerciseId`.
   */
  workoutExerciseId?: string | null
  exerciseNameSnapshot: string
  setNumber: number
  repsLogged: string
  weightLogged: number
  estimatedOneRM: number
  wasPr: boolean
  loggedAt: number
  rir?: number
  restSeconds?: number | null
  /**
   * Prescription Snapshot — the engine's pristine target for this set at
   * session-start. Persisted to `set_logs.prescribed_*` columns so the engine
   * can read its own past suggestions instead of the (now no-op) writeback
   * onto `workout_exercises`. Optional for legacy queued payloads. See ADR 0006.
   */
  prescribedReps?: number | null
  prescribedWeight?: number | null
  prescribedSets?: number | null
}

/** Time-based set log; mutually exclusive with reps fields at rest. */
export type SetLogPayloadDuration = {
  sessionId: string
  exerciseId: string
  /** See {@link SetLogPayloadReps.blockExerciseId}. */
  blockExerciseId?: string | null
  /** See {@link SetLogPayloadReps.workoutExerciseId}. */
  workoutExerciseId?: string | null
  exerciseNameSnapshot: string
  setNumber: number
  weightLogged: number
  loggedAt: number
  durationSeconds: number
  /** Omitted on legacy queued payloads — treated as false in `processSetLog`. */
  wasPr?: boolean
  restSeconds?: number | null
  /** Prescription Snapshot — see {@link SetLogPayloadReps}. */
  prescribedDurationSeconds?: number | null
  prescribedWeight?: number | null
  prescribedSets?: number | null
}

export type SetLogPayload = SetLogPayloadReps | SetLogPayloadDuration

export interface BlockRunPayload {
  sessionId: string
  blockId: string
  startedAt: number
  finishedAt: number | null
  mode: "amrap"
  capSeconds: number
  templateFingerprint: string
  /** Catalog identity at GO. Null = jetable. Snapshot — later block retargets must not rewrite it. */
  benchmarkCircuitId: string | null
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
}

/** Optional one-line session note (T267). Null clears the column. */
export interface SessionNotePayload {
  sessionId: string
  note: string | null
}

/** Tombstone: a re-log returned the set to its prescription (T266). */
export interface DeviationDeletePayload {
  sessionId: string
  workoutExerciseId: string | null
  exerciseId: string | null
  setNumber: number
  kind: DeviationKind
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface QueueItem {
  type:
    | "set_log"
    | "session_finish"
    | "block_run"
    | "deviation"
    | "deviation_delete"
    | "session_note"
  payload:
    | SetLogPayload
    | SessionFinishPayload
    | BlockRunPayload
    | DeviationPayload
    | DeviationDeletePayload
    | SessionNotePayload
  realSessionId: string
  queuedAt: number
  dedupeComposite: string
  fingerprint: string
}

export interface SessionMeta {
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

/**
 * Strictly monotonic enqueue timestamp. `Date.now()` alone can return the same
 * millisecond for two enqueues (e.g. a correction replacing an item while a
 * drain is in flight), which makes the drain's snapshot/add detection treat a
 * fresh item as the one it already processed and drop it. Bumping past the last
 * value guarantees a replacement is distinguishable from its predecessor.
 */
let lastQueuedAt = 0
function stamp(): number {
  const now = Date.now()
  lastQueuedAt = now > lastQueuedAt ? now : lastQueuedAt + 1
  return lastQueuedAt
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
 * Write a `sessionMeta` entry without minting a UUID. Used by the resume path
 * (#571) to point a reopened local session at the orphan's real row before any
 * set is logged — otherwise `resolveSessionMeta` would mint a fresh UUID and
 * split the resumed session into two rows. Write-only and idempotent.
 */
export function seedSessionMeta(
  userId: string,
  localSessionId: string,
  meta: SessionMeta,
): void {
  const allMeta = getSessionMeta(userId)
  allMeta[localSessionId] = meta
  setSessionMeta(userId, allMeta)
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

/**
 * Every `realSessionId` still present in the offline queue (any item type).
 *
 * Read-only. Used by the orphan-session self-heal (#568) to skip sessions the
 * queue still owns: a queued `session_finish` would otherwise drain later and
 * overwrite an auto-close `finished_at` with `now()`.
 */
export function queuedRealSessionIds(): Set<string> {
  const userId = getUserId()
  if (!userId) return new Set()
  return new Set(getQueue(userId).map((item) => item.realSessionId))
}

/** Set-log payloads still in the offline queue for a local session id. */
export function queuedSetLogPayloadsForSession(
  localSessionId: string,
): SetLogPayload[] {
  const userId = getUserId()
  if (!userId) return []
  return getQueue(userId)
    .filter((item) => item.type === "set_log")
    .filter((item) => item.payload.sessionId === localSessionId)
    .map((item) => item.payload as SetLogPayload)
}

/** Deviation payloads still in the offline queue for a local session id. */
export function queuedDeviationsForSession(
  localSessionId: string,
): DeviationPayload[] {
  const userId = getUserId()
  if (!userId) return []
  return getQueue(userId)
    .filter((item) => item.type === "deviation")
    .filter((item) => item.payload.sessionId === localSessionId)
    .map((item) => item.payload as DeviationPayload)
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
  // Mirror the DB's log_slot: COALESCE(block_exercise_id, workout_exercise_id,
  // exercise_id). Block cells and solo Exercise Slots stay distinct when they
  // share a catalog exercise_id (#351 / #463).
  const slot =
    payload.blockExerciseId ??
    payload.workoutExerciseId ??
    payload.exerciseId
  const composite = `${meta.realId}|${slot}|${payload.setNumber}`

  const queue = getQueue(userId)
  const fp = fingerprint(composite)

  // Replace any existing queue item for the same (session, exercise, set)
  // so that uncheck → re-check overwrites with the latest values.
  const filtered = queue.filter((item) => item.fingerprint !== fp)

  const item: QueueItem = {
    type: "set_log",
    payload,
    realSessionId: meta.realId,
    queuedAt: stamp(),
    dedupeComposite: composite,
    fingerprint: fp,
  }

  filtered.push(item)
  setQueue(userId, filtered)
  updatePendingCount(userId)
}

export function enqueueBlockRun(payload: BlockRunPayload): void {
  const userId = getUserId()
  if (!userId) {
    console.warn("[SyncService] enqueueBlockRun called without auth")
    return
  }

  const meta = resolveSessionMeta(userId, payload.sessionId)
  const composite = `${meta.realId}|block_run|${payload.blockId}`
  const fp = fingerprint(composite)
  const queue = getQueue(userId)
  const filtered = queue.filter((item) => item.fingerprint !== fp)

  filtered.push({
    type: "block_run",
    payload,
    realSessionId: meta.realId,
    queuedAt: stamp(),
    dedupeComposite: composite,
    fingerprint: fp,
  })
  setQueue(userId, filtered)
  updatePendingCount(userId)
}

/** Queued Block Run for this local session × block, if GO already stamped. */
export function queuedBlockRunFor(
  localSessionId: string,
  blockId: string,
): BlockRunPayload | null {
  const userId = getUserId()
  if (!userId) return null
  const match = getQueue(userId).find((item) => {
    if (item.type !== "block_run") return false
    const payload = item.payload
    return (
      "blockId" in payload &&
      payload.sessionId === localSessionId &&
      payload.blockId === blockId
    )
  })
  if (!match || !("blockId" in match.payload)) return null
  return match.payload
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
    queuedAt: stamp(),
    dedupeComposite: composite,
    fingerprint: fp,
  }

  queue.push(item)
  setQueue(userId, queue)
  updatePendingCount(userId)
}

/**
 * Queue a Deviation Reason (T266). One item per (session × slot × set), so a
 * corrected reason overwrites. A null `reasonCode` is kept — the skip is data.
 * Offline-first, drained by the same queue as set logs.
 */
export function enqueueDeviation(payload: DeviationPayload): void {
  const userId = getUserId()
  if (!userId) {
    console.warn("[SyncService] enqueueDeviation called without auth")
    return
  }

  const meta = resolveSessionMeta(userId, payload.sessionId)
  const slot = payload.workoutExerciseId ?? payload.exerciseId ?? "unknown"
  const composite = `${meta.realId}|deviation|${slot}|${payload.setNumber}`
  const fp = fingerprint(composite)

  const queue = getQueue(userId)
  const filtered = queue.filter((item) => item.fingerprint !== fp)

  filtered.push({
    type: "deviation",
    payload,
    realSessionId: meta.realId,
    queuedAt: stamp(),
    dedupeComposite: composite,
    fingerprint: fp,
  })
  setQueue(userId, filtered)
  updatePendingCount(userId)
}

/**
 * Queue the optional one-line session note (T267). One item per session, so a
 * re-typed note overwrites; a blank note clears the column. Offline-first.
 */
export function enqueueSessionNote(sessionId: string, note: string): void {
  const userId = getUserId()
  if (!userId) {
    console.warn("[SyncService] enqueueSessionNote called without auth")
    return
  }

  const meta = resolveSessionMeta(userId, sessionId)
  const composite = `${meta.realId}|session_note`
  const fp = fingerprint(composite)

  const queue = getQueue(userId)
  const filtered = queue.filter((item) => item.fingerprint !== fp)

  filtered.push({
    type: "session_note",
    payload: { sessionId, note: note.trim() || null },
    realSessionId: meta.realId,
    queuedAt: stamp(),
    dedupeComposite: composite,
    fingerprint: fp,
  })
  setQueue(userId, filtered)
  updatePendingCount(userId)
}

/**
 * Tombstone a deviation that no longer holds: the athlete unchecked the set,
 * restored the prescription, and logged it again (T266). Same identity, so a
 * later event for the same set is replaced by a delete on drain.
 */
export function enqueueDeviationDelete(input: {
  sessionId: string
  workoutExerciseId: string | null
  exerciseId: string | null
  setNumber: number
  kind: DeviationKind
}): void {
  const userId = getUserId()
  if (!userId) {
    console.warn("[SyncService] enqueueDeviationDelete called without auth")
    return
  }

  const meta = resolveSessionMeta(userId, input.sessionId)
  const slot = input.workoutExerciseId ?? input.exerciseId ?? "unknown"
  const composite = `${meta.realId}|deviation_delete|${slot}|${input.setNumber}`
  const fp = fingerprint(composite)

  const queue = getQueue(userId)
  // Drop a pending re-add for the same identity — the delete supersedes it.
  const addComposite = `${meta.realId}|deviation|${slot}|${input.setNumber}`
  const addFp = fingerprint(addComposite)
  const filtered = queue.filter(
    (item) => item.fingerprint !== fp && item.fingerprint !== addFp,
  )

  filtered.push({
    type: "deviation_delete",
    payload: { ...input },
    realSessionId: meta.realId,
    queuedAt: stamp(),
    dedupeComposite: composite,
    fingerprint: fp,
  })
  setQueue(userId, filtered)
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
 * Cancel a single in-progress block: drop its still-queued set_logs and
 * best-effort delete any already-persisted rows for the session × block
 * exercises (#351). Queue surgery always succeeds; the remote delete is a no-op
 * when offline (the queued items are gone, so nothing re-syncs). Returns once
 * the local queue is clean — callers don't need to await the remote delete.
 */
/** Drop a queued Block Run and best-effort DELETE the persisted row. */
export async function discardBlockRun(
  realSessionId: string,
  blockId: string,
): Promise<void> {
  const userId = getUserId()
  if (!userId) return

  const queue = getQueue(userId)
  const surviving = queue.filter((item) => {
    if (item.type !== "block_run" || item.realSessionId !== realSessionId) {
      return true
    }
    const payload = item.payload
    return !("blockId" in payload) || payload.blockId !== blockId
  })
  if (surviving.length !== queue.length) {
    setQueue(userId, surviving)
    updatePendingCount(userId)
  }

  try {
    await supabase
      .from("block_runs")
      .delete()
      .eq("session_id", realSessionId)
      .eq("block_id", blockId)
  } catch {
    // Offline: queue item is gone so nothing re-syncs.
  }
}

export async function discardBlockSetLogs(
  realSessionId: string,
  blockExerciseIds: string[],
): Promise<void> {
  const userId = getUserId()
  if (!userId || blockExerciseIds.length === 0) return

  const idSet = new Set(blockExerciseIds)
  const queue = getQueue(userId)
  const surviving = queue.filter((item) => {
    if (item.type !== "set_log" || item.realSessionId !== realSessionId) {
      return true
    }
    const beId = (item.payload as SetLogPayload).blockExerciseId
    return beId == null || !idSet.has(beId)
  })
  if (surviving.length !== queue.length) {
    setQueue(userId, surviving)
    updatePendingCount(userId)
  }

  try {
    await supabase
      .from("set_logs")
      .delete()
      .eq("session_id", realSessionId)
      .in("block_exercise_id", blockExerciseIds)
  } catch {
    // Offline / failure: queued rows are already removed; anything persisted
    // reconciles on a later manual cancel when back online.
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
  const workoutExerciseIds = new Set<string>()
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
        if (p.workoutExerciseId) workoutExerciseIds.add(p.workoutExerciseId)
        const ok = await processSetLog(item)
        if (!ok) surviving.push(item)
      } else if (item.type === "block_run") {
        const ok = await processBlockRun(item)
        if (!ok) surviving.push(item)
      } else if (item.type === "deviation") {
        const ok = await processDeviation(item)
        if (!ok) surviving.push(item)
      } else if (item.type === "deviation_delete") {
        const ok = await processDeviationDelete(item)
        if (!ok) surviving.push(item)
      } else if (item.type === "session_note") {
        const ok = await processSessionNote(item, userId)
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
  // Key on fingerprint AND queuedAt: a corrected item enqueued during the drain
  // replaced the old one in place (same fingerprint), so fingerprint alone would
  // drop the correction. Re-queued items get a fresh queuedAt.
  const snapshotKeys = new Set(
    queue.map((i) => `${i.fingerprint}:${i.queuedAt}`),
  )
  const addedDuringDrain = currentQueue.filter(
    (item) => !snapshotKeys.has(`${item.fingerprint}:${item.queuedAt}`),
  )

  // Persist surviving (failed) items + items added during this drain run.
  // Dedupe by fingerprint, newest wins: a correction that superseded a failed
  // snapshot item must not leave both versions behind.
  const merged = new Map(
    [...surviving, ...addedDuringDrain].map((i) => [i.fingerprint, i] as const),
  )
  setQueue(userId, [...merged.values()])
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

  // Cache invalidation for all touched exercises / slots (#463).
  // last-session-detail is keyed by workout_exercise_id first (T174).
  for (const weId of workoutExerciseIds) {
    queryClient.invalidateQueries({ queryKey: ["last-session-detail", weId] })
    queryClient.invalidateQueries({ queryKey: ["last-session", weId] })
  }
  if (workoutExerciseIds.size === 0 && exerciseIds.size > 0) {
    // Legacy queue items without workoutExerciseId — broad invalidate.
    queryClient.invalidateQueries({ queryKey: ["last-session-detail"] })
    queryClient.invalidateQueries({ queryKey: ["last-session"] })
  }
  queryClient.invalidateQueries({ queryKey: ["last-weights-slots"] })
  for (const exId of exerciseIds) {
    queryClient.invalidateQueries({ queryKey: ["best-1rm", exId] })
    queryClient.invalidateQueries({ queryKey: ["exercise-trend", exId] })
  }
  queryClient.invalidateQueries({ queryKey: ["sessions"] })
  queryClient.invalidateQueries({ queryKey: ["session-deviations"] })
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

async function upsertSession(
  row: {
    id: string
    user_id: string
    workout_day_id: string | null
    workout_label_snapshot: string
    started_at: string
    finished_at?: string
    active_duration_ms?: number
    total_sets_done?: number
    has_skipped_sets?: boolean
    cycle_id?: string | null
  },
  // The partial branch only needs the row to exist (FK): DO NOTHING on conflict
  // so it can never mutate a row it does not own — a closed session included.
  ignoreDuplicates = false,
) {
  const opts = { onConflict: "id", ignoreDuplicates }
  const first = await supabase.from("sessions").upsert(row, opts)
  if (first.error?.code !== "23503" || row.workout_day_id == null) {
    return first
  }
  return supabase.from("sessions").upsert(
    { ...row, workout_day_id: null },
    opts,
  )
}

async function upsertSetLog(row: {
  session_id: string
  exercise_id: string
  block_exercise_id: string | null
  workout_exercise_id: string | null
  exercise_name_snapshot: string
  set_number: number
  weight_logged: number
  logged_at: string
  reps_logged: string | null
  duration_seconds: number | null
  estimated_1rm: number | null
  was_pr: boolean
  rir: number | null
  rest_seconds: number | null
  prescribed_reps: number | null
  prescribed_weight: number | null
  prescribed_sets: number | null
  prescribed_duration_seconds: number | null
}) {
  const first = await supabase.from("set_logs").upsert(row, {
    onConflict: "session_id,log_slot,set_number",
  })
  const hasSlotFk =
    row.block_exercise_id != null || row.workout_exercise_id != null
  if (first.error?.code !== "23503" || !hasSlotFk) {
    return first
  }
  return supabase.from("set_logs").upsert(
    { ...row, block_exercise_id: null, workout_exercise_id: null },
    { onConflict: "session_id,log_slot,set_number" },
  )
}

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
      const { error } = await upsertSession({
        id: realSessionId,
        user_id: userId,
        workout_day_id: p.workoutDayId || null,
        workout_label_snapshot: p.workoutLabelSnapshot || "Workout",
        started_at: new Date(p.startedAt).toISOString(),
        finished_at: new Date(p.finishedAt).toISOString(),
        active_duration_ms: Math.max(0, Math.round(p.activeDurationMs)),
        // Kept for backward compatibility: the DB derives this from set_logs
        // and overrides whatever is sent (#654), so the value is harmless and
        // a release that outruns the migration does not regress to 0.
        total_sets_done: p.totalSetsDone,
        has_skipped_sets: p.hasSkippedSets,
        cycle_id: p.cycleId ?? null,
      })
      if (error) {
        console.error("[SyncService] session upsert failed", error)
        return false
      }
    } else {
      // Partial session (mid-session drain — no finish yet). Insert-only:
      // DO NOTHING on conflict, so a later drain — a note, a stray set_log —
      // can never mutate a closed row (total_sets_done, has_skipped_sets,
      // and any finish-owned column added later). See #635.
      const { error } = await upsertSession(
        {
          id: realSessionId,
          user_id: userId,
          workout_day_id: meta?.workoutDayId ?? null,
          workout_label_snapshot:
            meta?.workoutLabelSnapshot || "Workout",
          started_at: new Date(
            meta?.startedAt ?? Date.now(),
          ).toISOString(),
        },
        true,
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

async function processBlockRun(item: QueueItem): Promise<boolean> {
  const p = item.payload
  if (!("blockId" in p)) return false
  try {
    const { error } = await supabase.from("block_runs").upsert(
      {
        session_id: item.realSessionId,
        block_id: p.blockId,
        started_at: new Date(p.startedAt).toISOString(),
        finished_at:
          p.finishedAt == null ? null : new Date(p.finishedAt).toISOString(),
        mode: p.mode,
        cap_seconds: p.capSeconds,
        template_fingerprint: p.templateFingerprint,
        benchmark_circuit_id: p.benchmarkCircuitId ?? null,
      },
      { onConflict: "session_id,block_id" },
    )
    if (error) {
      console.error("[SyncService] block_run upsert failed", error)
      return false
    }
    return true
  } catch (e) {
    console.error("[SyncService] processBlockRun error", e)
    return false
  }
}

async function processDeviation(item: QueueItem): Promise<boolean> {
  const p = item.payload as DeviationPayload
  try {
    const row = {
      session_id: item.realSessionId,
      workout_exercise_id: p.workoutExerciseId ?? null,
      exercise_id: p.exerciseId ?? null,
      set_number: p.setNumber,
      kind: p.kind,
      reason_code: p.reasonCode,
      note: p.note,
    }
    const onConflict = "session_id,workout_exercise_id,set_number,kind"
    const first = await supabase
      .from("session_deviation_events")
      .upsert(row, { onConflict })
    const hasRefs =
      row.workout_exercise_id != null || row.exercise_id != null
    if (first.error?.code !== "23503" || !hasRefs) {
      if (first.error) {
        console.error("[SyncService] deviation upsert failed", first.error)
        return false
      }
      return true
    }
    // Template row gone (deleted exercise/slot): keep the reason, drop the refs.
    const retry = await supabase
      .from("session_deviation_events")
      .upsert(
        { ...row, workout_exercise_id: null, exercise_id: null },
        { onConflict },
      )
    if (retry.error) {
      console.error("[SyncService] deviation upsert retry failed", retry.error)
      return false
    }
    return true
  } catch (e) {
    console.error("[SyncService] processDeviation error", e)
    return false
  }
}

async function processSessionNote(
  item: QueueItem,
  userId: string,
): Promise<boolean> {
  const p = item.payload as SessionNotePayload
  try {
    const { error } = await supabase
      .from("sessions")
      .update({ session_note: p.note })
      .eq("id", item.realSessionId)
      .eq("user_id", userId)
    if (error) {
      console.error("[SyncService] session note update failed", error)
      return false
    }
    return true
  } catch (e) {
    console.error("[SyncService] processSessionNote error", e)
    return false
  }
}

async function processDeviationDelete(
  item: QueueItem,
): Promise<boolean> {
  const p = item.payload as DeviationDeletePayload
  try {
    let query = supabase
      .from("session_deviation_events")
      .delete()
      .eq("session_id", item.realSessionId)
      .eq("set_number", p.setNumber)
      .eq("kind", p.kind)
    if (p.workoutExerciseId) {
      query = query.eq("workout_exercise_id", p.workoutExerciseId)
    } else if (p.exerciseId) {
      query = query.eq("exercise_id", p.exerciseId)
    }
    const { error } = await query
    if (error) {
      console.error("[SyncService] deviation delete failed", error)
      return false
    }
    return true
  } catch (e) {
    console.error("[SyncService] processDeviationDelete error", e)
    return false
  }
}

async function processSetLog(item: QueueItem): Promise<boolean> {
  const p = item.payload as SetLogPayload
  try {
    const base = {
      session_id: item.realSessionId,
      exercise_id: p.exerciseId,
      block_exercise_id: p.blockExerciseId ?? null,
      workout_exercise_id: p.workoutExerciseId ?? null,
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
      // Prescription Snapshot — see ADR 0006. Reps payload doesn't carry a
      // duration prescription (and vice versa); each branch nulls the other.
      prescribed_reps: isDuration ? null : (p.prescribedReps ?? null),
      prescribed_weight: p.prescribedWeight ?? null,
      prescribed_sets: p.prescribedSets ?? null,
      prescribed_duration_seconds: isDuration ? (p.prescribedDurationSeconds ?? null) : null,
    }

    const { error } = await upsertSetLog(row)

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
    const { error } = await upsertSession({
      id: item.realSessionId,
      user_id: userId,
      workout_day_id: p.workoutDayId || null,
      workout_label_snapshot: p.workoutLabelSnapshot || "Workout",
      started_at: new Date(p.startedAt).toISOString(),
      finished_at: new Date(p.finishedAt).toISOString(),
      active_duration_ms: Math.max(0, Math.round(p.activeDurationMs)),
      // Derived by the DB from set_logs; sending it is tolerated and ignored (#654).
      total_sets_done: p.totalSetsDone,
      has_skipped_sets: p.hasSkippedSets,
      cycle_id: p.cycleId ?? null,
    })

    if (error) {
      console.error("[SyncService] session finish upsert failed", error)
      return false
    }

    // Writeback removed per ADR 0006 — the engine now reads from
    // set_logs.prescribed_* (the Prescription Snapshot), so mutating the
    // template here would re-introduce the bug at #373. Legacy queued
    // payloads carrying `progressionTargets` are tolerated (the field is
    // ignored); no queue migration needed.

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

    const unlocked = await grantAchievementsForUser(userId)
    if (unlocked.length > 0) {
      pushAchievementsToQueue(unlocked)
      store.set(lastSessionBadgesAtom, unlocked)
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
