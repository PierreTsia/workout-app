-- Latest-session set_logs for an array of exercises, used by useProgressionSuggestionsForDay
-- to render Progression Suggestion-based values on the pre-session list (#371, ADR 0005).
-- SECURITY INVOKER: RLS on sessions / set_logs applies via auth.uid().
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_logged_at
  ON set_logs (exercise_id, logged_at DESC);

CREATE OR REPLACE FUNCTION get_last_performance_for_exercises(
  p_exercise_ids uuid[]
)
RETURNS TABLE (
  exercise_id uuid,
  session_id uuid,
  set_number integer,
  reps_logged text,
  weight_logged numeric,
  rir integer,
  duration_seconds integer,
  logged_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH latest_session_per_exercise AS (
    SELECT DISTINCT ON (sl.exercise_id)
      sl.exercise_id,
      sl.session_id
    FROM set_logs sl
    JOIN sessions s ON s.id = sl.session_id
    WHERE sl.exercise_id = ANY(p_exercise_ids)
      AND s.user_id = auth.uid()
    ORDER BY sl.exercise_id, sl.logged_at DESC
  )
  SELECT
    sl.exercise_id,
    sl.session_id,
    sl.set_number,
    sl.reps_logged,
    sl.weight_logged,
    sl.rir,
    sl.duration_seconds,
    sl.logged_at
  FROM set_logs sl
  JOIN latest_session_per_exercise lsp
    ON sl.exercise_id = lsp.exercise_id
    AND sl.session_id = lsp.session_id
  ORDER BY sl.exercise_id, sl.set_number;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_performance_for_exercises(uuid[]) TO authenticated;
