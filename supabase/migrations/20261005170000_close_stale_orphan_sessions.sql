-- #654 follow-up (3/3) — close the stale orphan sessions the client self-heal
-- would close on its own, but only once the user reopens the app.
--
-- An open session (`finished_at IS NULL`) whose last set is older than the 3 h
-- idle threshold is abandoned (same rule as `computeOrphanClose` /
-- ORPHAN_SESSION_THRESHOLD_MS). The client `useOrphanSessionClose` closes it at
-- the owner's next app open; this one-shot sweep does it server-side so the row
-- stops showing as "unfinished" in the dashboard immediately.
--
-- Same payload as `closeOpenSession`, derived from the set logs: finished_at =
-- last set (never now()), total_sets_done = COUNT, active_duration_ms =
-- last − first floored at 0, has_skipped_sets = false (not reconstructible).
-- Only sessions with at least one set match the aggregate, so an empty open
-- session is never touched, and `.finished_at IS NULL` keeps it idempotent.

UPDATE public.sessions s
SET finished_at = agg.finished_at,
    total_sets_done = agg.total_sets_done,
    active_duration_ms = agg.active_duration_ms,
    has_skipped_sets = false
FROM (
  SELECT
    sl.session_id,
    MAX(sl.logged_at) AS finished_at,
    COUNT(*) AS total_sets_done,
    GREATEST(
      0,
      (EXTRACT(EPOCH FROM (MAX(sl.logged_at) - MIN(sl.logged_at))) * 1000)::bigint
    ) AS active_duration_ms
  FROM public.set_logs sl
  GROUP BY sl.session_id
) agg
WHERE s.id = agg.session_id
  AND s.finished_at IS NULL
  AND agg.finished_at < now() - interval '3 hours';
