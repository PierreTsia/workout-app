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
 * A session whose last set is older than this is considered abandoned.
 *
 * 12 h is a ceiling, not a planned-duration estimate: the session row carries
 * no planned duration, and real sessions close 0–1 min after the last set
 * (measured in prod). 12 h is far beyond any live session while still catching
 * same-day orphans — including the one left open overnight (16 h spread).
 */
export const ORPHAN_SESSION_THRESHOLD_MS = 12 * 60 * 60 * 1000

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
