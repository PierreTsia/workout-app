-- #463 / ADR 0012 / T173 — Slot-scoped Last Performance RPC.
--
-- Replaces get_last_performance_for_exercises (catalog-global) with
-- get_last_performance_for_slots (Exercise Slot + catalog exercise_id).
-- Caller must pass parallel arrays of equal length (enforced in client).

DROP FUNCTION IF EXISTS get_last_performance_for_exercises(uuid[]);

CREATE OR REPLACE FUNCTION get_last_performance_for_slots(
  p_workout_exercise_ids uuid[],
  p_exercise_ids uuid[]
)
RETURNS TABLE (
  workout_exercise_id uuid,
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
  WITH slots AS (
    SELECT *
    FROM unnest(p_workout_exercise_ids, p_exercise_ids)
      AS t(workout_exercise_id, exercise_id)
  ),
  latest_session_per_slot AS (
    SELECT DISTINCT ON (sl.workout_exercise_id, sl.exercise_id)
      sl.workout_exercise_id,
      sl.exercise_id,
      sl.session_id
    FROM set_logs sl
    JOIN sessions s ON s.id = sl.session_id
    JOIN slots sp
      ON sp.workout_exercise_id = sl.workout_exercise_id
     AND sp.exercise_id = sl.exercise_id
    WHERE s.user_id = auth.uid()
      AND sl.block_exercise_id IS NULL
      AND sl.workout_exercise_id IS NOT NULL
    ORDER BY sl.workout_exercise_id, sl.exercise_id, sl.logged_at DESC
  )
  SELECT
    sl.workout_exercise_id,
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
  JOIN latest_session_per_slot lsp
    ON sl.workout_exercise_id = lsp.workout_exercise_id
   AND sl.exercise_id = lsp.exercise_id
   AND sl.session_id = lsp.session_id
  JOIN sessions s ON s.id = sl.session_id
  WHERE sl.block_exercise_id IS NULL
  ORDER BY sl.workout_exercise_id, sl.exercise_id, sl.set_number;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_performance_for_slots(uuid[], uuid[]) TO authenticated;
