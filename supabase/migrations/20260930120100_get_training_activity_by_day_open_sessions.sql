-- #568 — count a session on the day it happened, not only when it closed.
-- Per-day aggregates for closed sessions plus still-open sessions (finish never
-- landed) that have at least one set. The day key mirrors the client
-- (`sessionsForDay`): `COALESCE(finished_at, started_at)`, so a dotted day in
-- the heatmap always has a matching row in the day list.
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
    (COALESCE(s.finished_at, s.started_at) AT TIME ZONE p_tz)::date AS day,
    COUNT(*)::bigint AS session_count,
    COALESCE(
      SUM(
        GREATEST(
          0,
          (EXTRACT(EPOCH FROM (COALESCE(s.finished_at, s.started_at) - s.started_at)) / 60)::bigint
        )
      ),
      0
    ) AS minutes
  FROM sessions s
  WHERE s.user_id = auth.uid()
    AND (
      s.finished_at IS NOT NULL
      OR EXISTS (SELECT 1 FROM set_logs sl WHERE sl.session_id = s.id)
    )
    AND (COALESCE(s.finished_at, s.started_at) AT TIME ZONE p_tz)::date >= p_from
    AND (COALESCE(s.finished_at, s.started_at) AT TIME ZONE p_tz)::date <= p_to
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_training_activity_by_day(date, date, text) TO authenticated;
