-- Profil snapshot for first-paint 7/30/100 (200d) and 1y (730d).
-- SECURITY INVOKER: RLS on sessions / set_logs / workout_days applies; the
-- body still pins user_id = auth.uid() so a keyless caller gets nothing.
-- Session time is NOT computed here — the client sums active_duration_ms with
-- the same wall-clock fallback as get_cycle_stats. Do not confuse with
-- get_training_activity_by_day.minutes (always wall-clock, pauses included).

CREATE OR REPLACE FUNCTION public.get_profile_snapshot(
  p_from date,
  p_to date,
  p_tz text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH windowed AS (
    SELECT
      s.id,
      s.started_at,
      s.finished_at,
      s.active_duration_ms,
      s.workout_day_id
    FROM sessions s
    WHERE s.user_id = auth.uid()
      AND s.finished_at IS NOT NULL
      AND (s.finished_at AT TIME ZONE p_tz)::date >= p_from
      AND (s.finished_at AT TIME ZONE p_tz)::date <= p_to
  )
  SELECT jsonb_build_object(
    'sessions', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'started_at', w.started_at,
            'finished_at', w.finished_at,
            'active_duration_ms', w.active_duration_ms,
            'program_id', wd.program_id,
            'has_catalog_circuit', EXISTS (
              SELECT 1
              FROM exercise_blocks eb
              WHERE eb.workout_day_id = w.workout_day_id
                AND eb.benchmark_circuit_id IS NOT NULL
            )
          )
          ORDER BY w.finished_at ASC
        )
        FROM windowed w
        LEFT JOIN workout_days wd ON wd.id = w.workout_day_id
      ),
      '[]'::jsonb
    ),
    'sets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'session_id', sl.session_id,
            'exercise_id', sl.exercise_id,
            'was_pr', sl.was_pr,
            'rir', sl.rir,
            'weight_logged', sl.weight_logged,
            'reps', sl.reps_logged,
            'duration_seconds', sl.duration_seconds,
            'block_exercise_id', sl.block_exercise_id
          )
        )
        FROM set_logs sl
        WHERE sl.session_id IN (SELECT id FROM windowed)
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_profile_snapshot(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_snapshot(date, date, text) TO authenticated;
