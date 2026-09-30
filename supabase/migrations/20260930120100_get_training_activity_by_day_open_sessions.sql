-- #568 — count a session on its last-known instant, not only on finished_at.
-- Per-day aggregates for sessions that have at least one set: closed sessions
-- bucket on `finished_at`, still-open sessions (finish never landed) on their
-- last `set_logs.logged_at`. The `minutes` column uses the same instant so an
-- open session reports its real span.
--
-- Supersedes the finished_at-only version (20260323120000_get_training_activity_by_day.sql).
CREATE OR REPLACE FUNCTION public.get_training_activity_by_day(
  p_from date,
  p_to date,
  p_tz text
)
RETURNS TABLE (
  day date,
  session_count bigint,
  minutes bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (COALESCE(s.finished_at, last_set.at) AT TIME ZONE p_tz)::date AS day,
    COUNT(*)::bigint AS session_count,
    COALESCE(
      SUM(
        GREATEST(
          0,
          (EXTRACT(EPOCH FROM (COALESCE(s.finished_at, last_set.at) - s.started_at)) / 60)::bigint
        )
      ),
      0
    ) AS minutes
  FROM sessions s
  JOIN LATERAL (
    SELECT MAX(sl.logged_at) AS at
    FROM set_logs sl
    WHERE sl.session_id = s.id
  ) last_set ON TRUE
  WHERE s.user_id = auth.uid()
    AND COALESCE(s.finished_at, last_set.at) IS NOT NULL
    AND (COALESCE(s.finished_at, last_set.at) AT TIME ZONE p_tz)::date >= p_from
    AND (COALESCE(s.finished_at, last_set.at) AT TIME ZONE p_tz)::date <= p_to
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_training_activity_by_day(date, date, text) TO authenticated;
