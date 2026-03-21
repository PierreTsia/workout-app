-- Last N finished sessions for an exercise, with sets ordered by set_number.
-- SECURITY INVOKER: RLS on sessions and set_logs applies via auth.uid().
CREATE OR REPLACE FUNCTION get_exercise_history_for_sheet(
  p_exercise_id uuid,
  p_session_limit int DEFAULT 5
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH lim AS (
    SELECT LEAST(GREATEST(COALESCE(NULLIF(p_session_limit, 0), 5), 1), 50) AS n
  ),
  recent AS (
    SELECT s.id, s.finished_at
    FROM sessions s
    CROSS JOIN lim
    WHERE s.user_id = auth.uid()
      AND s.finished_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM set_logs sl
        WHERE sl.session_id = s.id
          AND sl.exercise_id = p_exercise_id
      )
    ORDER BY s.finished_at DESC
    LIMIT (SELECT n FROM lim)
  )
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'session_id', r.id,
          'finished_at', r.finished_at,
          'sets', (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', sl.id,
                  'set_number', sl.set_number,
                  'reps_logged', sl.reps_logged,
                  'weight_logged', sl.weight_logged,
                  'rir', sl.rir,
                  'estimated_1rm', sl.estimated_1rm
                )
                ORDER BY sl.set_number ASC
              ),
              '[]'::jsonb
            )
            FROM set_logs sl
            WHERE sl.session_id = r.id
              AND sl.exercise_id = p_exercise_id
          )
        )
        ORDER BY r.finished_at DESC
      )
      FROM recent r
    ),
    '[]'::jsonb
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_exercise_history_for_sheet(uuid, int) TO authenticated;
