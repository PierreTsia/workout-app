-- #654 follow-up — clean up the rows the pre-fix finish path left behind.
--
-- 1. Finished sessions with zero set_logs. The old finish had no zero-set guard
--    (fixed in #654 F1), so finishing an untouched session wrote a closed row
--    (0 sets, has_skipped_sets = true) — invisible training, visible noise in the
--    dashboard's "Latest sessions". The client now abandons such a session
--    (delete + deny-list) instead of closing it. Every FK to `sessions`
--    (`set_logs`, `block_runs`, `session_deviation_events`) is ON DELETE CASCADE,
--    and the predicate spares any session that logged a circuit via `block_runs`.
--
--    Side effect, accepted: 12 empty rows across 11 cycles were each the only
--    finished session of their (cycle, day); deleting them drops those phantom
--    day-completions, which is the point — no set was ever logged on those days.
--
-- 2. `active_duration_ms` inflated past 12 h by the old wall-clock path
--    (pre-#655). Recompute as last set − first set, exactly like the #568 orphan
--    backfill. The ceiling keeps normal rows (and their explicit pauses) intact:
--    a legitimate session never spans 12 h of logged sets.

DELETE FROM public.sessions s
WHERE s.finished_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.set_logs sl WHERE sl.session_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.block_runs br WHERE br.session_id = s.id);

UPDATE public.sessions s
SET active_duration_ms = GREATEST(
  0,
  (
    SELECT (EXTRACT(EPOCH FROM (MAX(sl.logged_at) - MIN(sl.logged_at))) * 1000)::bigint
    FROM public.set_logs sl
    WHERE sl.session_id = s.id
  )
)
WHERE s.finished_at IS NOT NULL
  AND s.active_duration_ms > 12 * 60 * 60 * 1000
  AND (SELECT COUNT(*) FROM public.set_logs sl WHERE sl.session_id = s.id) >= 2;
