-- #654 follow-up (2/2) — reconstruct `active_duration_ms` for the sessions the
-- last−first rule could not fix.
--
-- One historical session (`a065f749`, 29→30/09) kept 16 sets spread over ~19 h
-- between its first and last log because the app was left open overnight. Its
-- span is genuinely 19 h, so `session_empty_backfill`'s last−first recompute
-- left it over the 12 h ceiling — the sets really do span the night.
--
-- The active time is the span minus every gap between consecutive sets longer
-- than 3 h (the same idle threshold the orphan self-heal uses): a >3 h silence
-- between sets means the workout was left, not trained. Scoped to rows still
-- over 12 h so normal sessions and their explicit pauses are untouched.

WITH ordered AS (
  SELECT
    sl.session_id,
    sl.logged_at,
    sl.logged_at
      - LAG(sl.logged_at) OVER (PARTITION BY sl.session_id ORDER BY sl.logged_at) AS gap
  FROM public.set_logs sl
),
big_gaps AS (
  SELECT
    session_id,
    (SUM(EXTRACT(EPOCH FROM gap)) * 1000)::bigint AS gap_ms
  FROM ordered
  WHERE gap > interval '3 hours'
  GROUP BY session_id
),
span AS (
  SELECT
    sl.session_id,
    (EXTRACT(EPOCH FROM (MAX(sl.logged_at) - MIN(sl.logged_at))) * 1000)::bigint AS span_ms
  FROM public.set_logs sl
  GROUP BY sl.session_id
)
UPDATE public.sessions s
SET active_duration_ms = GREATEST(0, sp.span_ms - COALESCE(bg.gap_ms, 0))
FROM span sp
LEFT JOIN big_gaps bg ON bg.session_id = sp.session_id
WHERE s.id = sp.session_id
  AND s.finished_at IS NOT NULL
  AND s.active_duration_ms > 12 * 60 * 60 * 1000
  AND (SELECT COUNT(*) FROM public.set_logs sl WHERE sl.session_id = s.id) >= 2;
