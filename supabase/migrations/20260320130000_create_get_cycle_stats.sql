-- Aggregates cycle-level stats (sessions, duration, volume, sets, PRs)
-- with optional comparison deltas against a previous cycle.
-- Used by the Cycle Completion Summary page.
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
  -- Session-level aggregates
  SELECT
    COUNT(*)::int,
    EXTRACT(EPOCH FROM COALESCE(SUM(s.finished_at - s.started_at), INTERVAL '0'))::bigint * 1000,
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

  -- Set-level aggregates (volume + PRs) — separate query to avoid
  -- double-counting total_sets_done when joining through set_logs
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

  -- Optional: deltas vs previous cycle
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
