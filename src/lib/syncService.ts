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
} from "@/store/atoms"
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

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function queueKey(userId: string) {
  return `offlineQueue:${userId}`
}
function metaKey(userId: string) {
  return `sessionMeta:${userId}`
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

let draining = false

export async function drainQueue(userId: string): Promise<void> {
  if (draining) return
  const queue = getQueue(userId)
  if (queue.length === 0) return

  draining = true
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

  // Persist surviving items
  setQueue(userId, surviving)
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
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "workout-exercises" })
  queryClient.invalidateQueries({ queryKey: ["pr-aggregates"] })
  queryClient.invalidateQueries({ queryKey: ["training-activity-by-day"] })
  queryClient.invalidateQueries({ queryKey: ["sessions-date-range"] })
  queryClient.invalidateQueries({ queryKey: ["active-cycle"] })
  queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })

  draining = false
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

    const row =
      "durationSeconds" in p
        ? {
            ...base,
            reps_logged: null,
            duration_seconds: p.durationSeconds,
            estimated_1rm: null,
            was_pr: false,
            rir: null,
          }
        : {
            ...base,
            reps_logged: p.repsLogged,
            duration_seconds: null,
            estimated_1rm: p.estimatedOneRM || null,
            was_pr: p.wasPr,
            rir: p.rir ?? null,
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
