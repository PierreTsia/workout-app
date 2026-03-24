-- Active (non-paused) training time per session; NULL = legacy (derive from wall clock).
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS active_duration_ms bigint NULL;

COMMENT ON COLUMN public.sessions.active_duration_ms IS
  'Milliseconds of active training excluding pause; NULL for rows written before this column existed.';

-- Cycle stats: sum per-session duration using active ms when present.
CREATE OR REPLACE FUNCTION get_cycle_stats(
  p_cycle_id uuid,
  p_previous_cycle_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_count   int;
  v_total_duration  bigint;
  v_total_sets      int;
  v_started_at      timestamptz;
  v_last_finished   timestamptz;
  v_total_volume    numeric;
  v_pr_count        int;
  v_duration_days   int;
  v_result          json;
  v_prev_volume     numeric;
  v_prev_sets       int;
  v_prev_prs        int;
BEGIN
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(
      COALESCE(
        s.active_duration_ms,
        GREATEST(0, (EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) * 1000)::bigint)
      )
    ), 0)::bigint,
    COALESCE(SUM(s.total_sets_done), 0)::int,
    c.started_at,
    MAX(s.finished_at)
  INTO v_session_count, v_total_duration, v_total_sets, v_started_at, v_last_finished
  FROM cycles c
  LEFT JOIN sessions s ON s.cycle_id = c.id AND s.finished_at IS NOT NULL
  WHERE c.id = p_cycle_id
  GROUP BY c.id, c.started_at;

  IF v_started_at IS NULL THEN
    RETURN json_build_object('error', 'cycle_not_found');
  END IF;

  SELECT
    COALESCE(SUM(sl.weight_logged * sl.reps_logged::int), 0)::numeric,
    COUNT(*) FILTER (WHERE sl.was_pr)::int
  INTO v_total_volume, v_pr_count
  FROM set_logs sl
  JOIN sessions s ON s.id = sl.session_id
  WHERE s.cycle_id = p_cycle_id
    AND s.finished_at IS NOT NULL
    AND sl.reps_logged ~ '^\d+$';

  v_duration_days := GREATEST(
    EXTRACT(DAY FROM (v_last_finished - v_started_at))::int + 1,
    1
  );

  v_result := json_build_object(
    'session_count',     v_session_count,
    'total_duration_ms', v_total_duration,
    'total_sets',        v_total_sets,
    'total_volume_kg',   v_total_volume,
    'pr_count',          v_pr_count,
    'started_at',        v_started_at,
    'last_finished_at',  v_last_finished,
    'duration_days',     v_duration_days
  );

  IF p_previous_cycle_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(sl.weight_logged * sl.reps_logged::int), 0)::numeric,
      COALESCE(SUM(s2.total_sets_done), 0)::int,
      COUNT(*) FILTER (WHERE sl.was_pr)::int
    INTO v_prev_volume, v_prev_sets, v_prev_prs
    FROM set_logs sl
    JOIN sessions s2 ON s2.id = sl.session_id
    WHERE s2.cycle_id = p_previous_cycle_id
      AND s2.finished_at IS NOT NULL
      AND sl.reps_logged ~ '^\d+$';

    v_result := v_result::jsonb || jsonb_build_object(
      'delta_volume_pct', CASE WHEN v_prev_volume > 0
        THEN ROUND(((v_total_volume - v_prev_volume) / v_prev_volume * 100)::numeric, 1)
        ELSE NULL END,
      'delta_sets_pct', CASE WHEN v_prev_sets > 0
        THEN ROUND(((v_total_sets - v_prev_sets)::numeric / v_prev_sets * 100)::numeric, 1)
        ELSE NULL END,
      'delta_prs_pct', CASE WHEN v_prev_prs > 0
        THEN ROUND(((v_pr_count - v_prev_prs)::numeric / v_prev_prs * 100)::numeric, 1)
        ELSE NULL END
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Training heatmap minutes: use active ms when set.
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
          (COALESCE(
            s.active_duration_ms,
            GREATEST(0, (EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) * 1000)::bigint)
          ) / 60000)::bigint
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
