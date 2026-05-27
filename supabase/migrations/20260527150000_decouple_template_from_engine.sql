-- Decouple Template Prescription from Progression Engine.
-- See ADR 0006 and Tech Plan for issue #373.
--
-- Three coordinated changes:
--   1. set_logs gets prescribed_* columns (the Prescription Snapshot).
--      Engine reads these on subsequent sessions instead of mutating
--      workout_exercises, breaking the feedback loop that caused the bug.
--   2. workout_exercises gets template_updated_at, maintained by a trigger,
--      to detect user-driven edits (the Manual Override Window).
--   3. get_last_performance_for_exercises RPC is extended to expose the
--      new columns + session_finished_at to the engine.

------------------------------------------------------------------------------
-- 1. Prescription Snapshot columns on set_logs
------------------------------------------------------------------------------

ALTER TABLE set_logs
  ADD COLUMN prescribed_reps integer,
  ADD COLUMN prescribed_weight numeric,
  ADD COLUMN prescribed_sets integer,
  ADD COLUMN prescribed_duration_seconds integer;

-- Eager backfill: legacy rows get prescribed = logged. Honest bounded lie
-- documented in ADR 0006 — a partially-failed last session is masked as a
-- clean one, bounded to at most one mislabel per affected user, then clean.
--
-- prescribed_sets uses COUNT(*) OVER (PARTITION BY ...) in a single CTE
-- pass and is joined back by id — avoids the per-row correlated subquery
-- that would scale O(N^2) on the set_logs table.
--
-- reps_logged is TEXT and may contain range strings ("8-12") and other
-- non-integer junk left over from the very bug this migration is fixing
-- (the engine writeback that corrupted Builder data). Anything that isn't
-- a clean integer is mapped to NULL — engine treats that as "no snapshot"
-- and falls through to the template path, which is the safe default.
WITH set_counts AS (
  SELECT
    id,
    COUNT(*) OVER (PARTITION BY session_id, exercise_id) AS set_count
  FROM set_logs
)
UPDATE set_logs sl
SET
  prescribed_reps = CASE
    WHEN sl.duration_seconds IS NOT NULL THEN NULL
    WHEN sl.reps_logged IS NULL THEN NULL
    WHEN trim(sl.reps_logged) ~ '^[0-9]+$' THEN trim(sl.reps_logged)::integer
    ELSE NULL
  END,
  prescribed_weight = sl.weight_logged,
  prescribed_duration_seconds = sl.duration_seconds,
  prescribed_sets = sc.set_count::integer
FROM set_counts sc
WHERE sl.id = sc.id
  AND sl.prescribed_reps IS NULL
  AND sl.prescribed_weight IS NULL
  AND sl.prescribed_sets IS NULL
  AND sl.prescribed_duration_seconds IS NULL;

------------------------------------------------------------------------------
-- 2. Manual Override Window — template_updated_at on workout_exercises
------------------------------------------------------------------------------

ALTER TABLE workout_exercises
  ADD COLUMN template_updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill: stamp every existing row with now(). Critical invariant — all
-- workout_exercises post-migration have template_updated_at > any pre-migration
-- session.finished_at, but that's fine: the override window only fires when
-- the user EDITS the template post-session, and pre-migration there were no
-- such edits to consider. Engine will read from the (eagerly backfilled)
-- Prescription Snapshot on the first post-migration session.
UPDATE workout_exercises SET template_updated_at = now();

CREATE OR REPLACE FUNCTION bump_workout_exercise_template_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- IS DISTINCT FROM is NULL-safe — handles NULL → value, value → NULL,
  -- and same-value-no-op cases correctly.
  IF NEW.reps IS DISTINCT FROM OLD.reps
     OR NEW.weight IS DISTINCT FROM OLD.weight
     OR NEW.sets IS DISTINCT FROM OLD.sets
     OR NEW.target_duration_seconds IS DISTINCT FROM OLD.target_duration_seconds
  THEN
    NEW.template_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE UPDATE OF column_list at the trigger level skips unrelated UPDATEs
-- cheaply. The function-level IS DISTINCT FROM check then skips no-op writes
-- that happen to touch tracked columns with the same values.
CREATE TRIGGER trg_workout_exercises_template_updated_at
  BEFORE UPDATE OF reps, weight, sets, target_duration_seconds
  ON workout_exercises
  FOR EACH ROW
  EXECUTE FUNCTION bump_workout_exercise_template_updated_at();

------------------------------------------------------------------------------
-- 3. Extend the existing RPC with prescribed_* + session_finished_at
------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS get_last_performance_for_exercises(uuid[]);

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
  ORDER BY sl.exercise_id, sl.set_number;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_performance_for_exercises(uuid[]) TO authenticated;
