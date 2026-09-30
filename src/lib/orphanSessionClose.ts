/**
 * Orphan-session self-heal (issue PierreTsia/workout-app#568).
 *
 * A session is written in two beats: a partial row when mid-session set logs
 * sync, then a close when the user taps "Terminer". If the close never lands,
 * the row keeps `finished_at = null` and `total_sets_done = 0` while its
 * `set_logs` are all there — invisible in History.
 *
 * This module holds the pure decision: given a session's set logs and a clock,
 * decide whether it is stale enough to close, and with which values.
 */

/**
 * A session with no logged set for this long is considered abandoned.
 *
 * This is an **idle gap since the last set**, not a session-length ceiling:
 * a long-but-active session (sets keep coming) never trips it, only one that
 * has gone quiet for the whole window does. The session row carries no planned
 * duration, and prod closes 0–1 min after the last set, so 3 h is already far
 * beyond any live session while closing same-day orphans on the next open
 * instead of waiting half a day.
 */
export const ORPHAN_SESSION_THRESHOLD_MS = 3 * 60 * 60 * 1000

export interface OrphanClose {
  /** Last set's `logged_at` — never `now()`. */
  finishedAt: string
  totalSetsDone: number
  /** Last set − first set, floored at 0. */
  activeDurationMs: number
}

/**
 * Returns the close payload for a stale session, or `null` when it must be
 * left alone (no sets, unparseable timestamps, or last set within the
 * threshold — i.e. possibly still in progress).
 */
export function computeOrphanClose(
  logs: { logged_at: string }[],
  nowMs: number,
  thresholdMs: number = ORPHAN_SESSION_THRESHOLD_MS,
): OrphanClose | null {
  if (logs.length === 0) return null

  const times = logs
    .map((l) => new Date(l.logged_at).getTime())
    .filter((t) => Number.isFinite(t))
  if (times.length === 0) return null

  const last = Math.max(...times)
  if (nowMs - last <= thresholdMs) return null

  const first = Math.min(...times)
  return {
    finishedAt: new Date(last).toISOString(),
    totalSetsDone: logs.length,
    activeDurationMs: Math.max(0, last - first),
  }
}
