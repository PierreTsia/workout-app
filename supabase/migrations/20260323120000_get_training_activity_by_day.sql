-- Per-day aggregates for finished sessions (local calendar date in p_tz).
-- Sparse rows: only days with >= 1 session. Client gap-fills for heatmaps.
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
    (s.finished_at AT TIME ZONE p_tz)::date AS day,
    COUNT(*)::bigint AS session_count,
    COALESCE(
      SUM(
        GREATEST(
          0,
          (EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) / 60)::bigint
        )
      ),
      0
    ) AS minutes
  FROM sessions s
  WHERE s.user_id = auth.uid()
    AND s.finished_at IS NOT NULL
    AND (s.finished_at AT TIME ZONE p_tz)::date >= p_from
    AND (s.finished_at AT TIME ZONE p_tz)::date <= p_to
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_training_activity_by_day(date, date, text) TO authenticated;
