-- Exclude Exercise Block logs from the progression engine (#351, ADR 0007).
--
-- get_last_performance_for_exercises feeds Progression Suggestions. Block sets
-- now land in set_logs with block_exercise_id set; left unfiltered they would
-- pollute Last Performance for the solo exercise sharing that catalog id
-- (pyramidal, weightless rounds masquerading as the engine's anchor). Blocks
-- are frozen-prescription by design, so the engine must ignore them entirely.
--
-- Two guards:
--   * CTE: pick the latest NON-block session per exercise.
--   * Main: return only NON-block rows from that session.

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
  prescribed_reps integer,
  prescribed_weight numeric,
  prescribed_sets integer,
  prescribed_duration_seconds integer,
  logged_at timestamptz,
  session_finished_at timestamptz
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
      AND sl.block_exercise_id IS NULL
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
    sl.prescribed_reps,
    sl.prescribed_weight,
    sl.prescribed_sets,
    sl.prescribed_duration_seconds,
    sl.logged_at,
    s.finished_at AS session_finished_at
  FROM set_logs sl
  JOIN latest_session_per_exercise lsp
    ON sl.exercise_id = lsp.exercise_id
    AND sl.session_id = lsp.session_id
  JOIN sessions s ON s.id = sl.session_id
  WHERE sl.block_exercise_id IS NULL
  ORDER BY sl.exercise_id, sl.set_number;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_performance_for_exercises(uuid[]) TO authenticated;
