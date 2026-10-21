-- ADR 0033 — the plateau exit triggers on prescription stagnation, not on PLATEAU.
-- The engine needs the *served target* of the last N sessions of a slot
-- (`anchor_reps ?? prescribed_reps` + `prescribed_weight`, ADR 0032) to decide a
-- Deload. One row per (slot, session), oldest → newest; the client slices the
-- last N. Read-only: `prescribed_*` stays the pristine Prescription Snapshot.
CREATE FUNCTION public.get_slot_prescription_history(
  p_workout_exercise_ids uuid[],
  p_exercise_ids uuid[],
  p_before timestamptz DEFAULT now(),
  p_limit int DEFAULT 6
)
RETURNS TABLE (
  workout_exercise_id uuid, exercise_id uuid, session_id uuid,
  session_finished_at timestamptz, prescribed_reps integer, anchor_reps integer,
  prescribed_weight numeric, avg_rir numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF cardinality(p_workout_exercise_ids) IS DISTINCT FROM cardinality(p_exercise_ids) THEN
    RAISE EXCEPTION 'get_slot_prescription_history: parallel arrays length mismatch (% vs %)',
      cardinality(p_workout_exercise_ids), cardinality(p_exercise_ids)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  WITH per_session AS (
    SELECT sl.workout_exercise_id AS we_id,
           sl.exercise_id        AS ex_id,
           sl.session_id         AS sess_id,
           max(sl.logged_at)     AS last_logged_at,
           max(s.finished_at)    AS session_finished_at,
           max(sl.prescribed_reps)   AS prescribed_reps,
           -- ADR 0032: the anchor is the served target of the LAST logged set,
           -- read by set_number (pickAnchorSet), not an aggregate. NULL when
           -- that row carries none.
           (array_agg(sl.anchor_reps ORDER BY sl.set_number DESC NULLS LAST, sl.logged_at DESC))[1] AS anchor_reps,
           max(sl.prescribed_weight) AS prescribed_weight,
           avg(sl.rir) FILTER (WHERE sl.rir IS NOT NULL) AS avg_rir
    FROM set_logs sl
    JOIN sessions s ON s.id = sl.session_id
    JOIN unnest(p_workout_exercise_ids, p_exercise_ids)
      AS sp(workout_exercise_id, exercise_id)
      ON sp.workout_exercise_id = sl.workout_exercise_id
     AND sp.exercise_id = sl.exercise_id
    WHERE s.user_id = auth.uid()
      AND sl.block_exercise_id IS NULL
      AND sl.workout_exercise_id IS NOT NULL
      AND sl.duration_seconds IS NULL
      AND sl.prescribed_reps IS NOT NULL
    GROUP BY sl.workout_exercise_id, sl.exercise_id, sl.session_id
  ),
  recent AS (
    SELECT per_session.*,
      row_number() OVER (
        PARTITION BY per_session.we_id, per_session.ex_id
        ORDER BY per_session.last_logged_at DESC
      ) AS rn
    FROM per_session
    WHERE per_session.last_logged_at < p_before
  )
  SELECT recent.we_id, recent.ex_id, recent.sess_id, recent.session_finished_at,
         recent.prescribed_reps, recent.anchor_reps, recent.prescribed_weight, recent.avg_rir
  FROM recent
  WHERE recent.rn <= p_limit
  ORDER BY recent.we_id, recent.ex_id, recent.session_finished_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_slot_prescription_history(uuid[], uuid[], timestamptz, int)
  TO authenticated;
