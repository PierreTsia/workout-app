import { getDefaultStore } from "jotai"
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

export interface SetLogPayload {
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

export interface SessionFinishPayload {
  sessionId: string
  workoutDayId: string
  workoutLabelSnapshot: string
  startedAt: number
  finishedAt: number
  totalSetsDone: number
  hasSkippedSets: boolean
  cycleId?: string | null
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
  const composite = `${meta.realId}|${payload.exerciseId}|${payload.setNumber}|${payload.loggedAt}`

  const queue = getQueue(userId)

  // Local dedupe — skip if identical fingerprint already queued
  const fp = fingerprint(composite)
  if (queue.some((item) => item.fingerprint === fp)) return

  const item: QueueItem = {
    type: "set_log",
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

  // Group by realSessionId to ensure session rows exist before set_logs
  const sessionGroups = new Map<string, QueueItem[]>()
  for (const item of queue) {
    const group = sessionGroups.get(item.realSessionId) ?? []
    group.push(item)
    sessionGroups.set(item.realSessionId, group)
  }

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
    queryClient.invalidateQueries({ queryKey: ["best-1rm", exId] })
    queryClient.invalidateQueries({ queryKey: ["exercise-trend", exId] })
  }
  queryClient.invalidateQueries({ queryKey: ["sessions"] })
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
    // Dedupe check
    const { data: existing } = await supabase
      .from("set_logs")
      .select("id")
      .eq("session_id", item.realSessionId)
      .eq("exercise_id", p.exerciseId)
      .eq("set_number", p.setNumber)
      .eq("logged_at", new Date(p.loggedAt).toISOString())
      .limit(1)

    if (existing && existing.length > 0) return true // Already synced

    const { error } = await supabase.from("set_logs").insert({
      session_id: item.realSessionId,
      exercise_id: p.exerciseId,
      exercise_name_snapshot: p.exerciseNameSnapshot,
      set_number: p.setNumber,
      reps_logged: p.repsLogged,
      weight_logged: p.weightLogged,
      estimated_1rm: p.estimatedOneRM || null,
      was_pr: p.wasPr,
      logged_at: new Date(p.loggedAt).toISOString(),
      rir: p.rir ?? null,
    })

    if (error) {
      console.error("[SyncService] set_log insert failed", error)
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
    // Upsert with full data (covers both "session already exists" and "new session")
    const { error } = await supabase.from("sessions").upsert(
      {
        id: item.realSessionId,
        user_id: userId,
        workout_day_id: p.workoutDayId || null,
        workout_label_snapshot: p.workoutLabelSnapshot || "Workout",
        started_at: new Date(p.startedAt).toISOString(),
        finished_at: new Date(p.finishedAt).toISOString(),
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
