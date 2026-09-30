import { supabase } from "@/lib/supabase"
import { computeOrphanClose, type OrphanClose } from "@/lib/orphanSessionClose"
import {
  peekSessionRealId,
  pruneCancelledSessions,
  queuedRealSessionIds,
} from "@/lib/syncService"
import type { SessionState } from "@/store/atoms"

/** An open (`finished_at IS NULL`) session row with its set timestamps. */
export interface OpenSessionRow {
  id: string
  workout_day_id: string | null
  workout_label_snapshot: string | null
  started_at: string
  cycle_id: string | null
  set_logs: { logged_at: string }[] | null
}

interface SetLogTime {
  logged_at: string
}

/** A closed payload when the session is stale, the last set time otherwise, `null` with no sets. */
export type OpenSessionClassification =
  | { kind: "stale"; close: OrphanClose }
  | { kind: "recent"; lastSetAt: string }
  | null

/**
 * Reads the user's open sessions. RLS already scopes `sessions` to the caller;
 * the explicit `user_id` filter is defense-in-depth and keeps the contract
 * legible at the call site.
 */
export async function fetchOpenSessions(
  userId: string,
): Promise<OpenSessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, workout_day_id, workout_label_snapshot, started_at, cycle_id, set_logs(logged_at)",
    )
    .eq("user_id", userId)
    .is("finished_at", null)
    .returns<OpenSessionRow[]>()

  if (error) throw error
  return data ?? []
}

/** The real session ids a still-live local session owns — never orphans. */
export function excludedSessionIds(
  userId: string,
  session: SessionState,
): Set<string> {
  const excluded = queuedRealSessionIds()
  // A session cancelled while offline keeps its row (the best-effort delete
  // failed); the deny-list is the only marker. Without this, a cancelled
  // session would come back as "unfinished" and be closed into a real workout.
  for (const id of pruneCancelledSessions(userId)) excluded.add(id)
  if (session.isActive && session.startedAt != null) {
    const activeId = peekSessionRealId(userId, `local-${session.startedAt}`)
    if (activeId) excluded.add(activeId)
  }
  return excluded
}

/** First open session that this device does not still own, or `null`. */
export async function findBlockingOpenSession(
  userId: string,
  session: SessionState,
): Promise<OpenSessionRow | null> {
  const rows = await fetchOpenSessions(userId)
  const excluded = excludedSessionIds(userId, session)
  return rows.find((row) => !excluded.has(row.id)) ?? null
}

/**
 * Stale when `computeOrphanClose` produces a payload; recent when there is at
 * least one set and its last timestamp is inside the idle threshold; `null`
 * with no sets or no parseable timestamp.
 */
export function classifyOpenSession(
  logs: SetLogTime[],
  nowMs: number,
): OpenSessionClassification {
  const close = computeOrphanClose(logs, nowMs)
  if (close) return { kind: "stale", close }

  const times = logs
    .map((l) => new Date(l.logged_at).getTime())
    .filter((t) => Number.isFinite(t))
  if (times.length === 0) return null

  // `computeOrphanClose` returned null, so the last set is inside the threshold
  // (or in the future from clock skew) — either way, still possibly in progress.
  const last = Math.max(...times)
  return { kind: "recent", lastSetAt: new Date(last).toISOString() }
}
