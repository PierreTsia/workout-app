-- #463 / ADR 0012 / T172 — Persist Exercise Slot on set_logs (write path).
--
-- Solo logs gain workout_exercise_id so Last Performance can scope by
-- Exercise Slot. log_slot widens to COALESCE(block_exercise_id,
-- workout_exercise_id, exercise_id) so two same-catalog solos in one session
-- no longer collide at upsert.
--
-- RPC replace (get_last_performance_for_slots) lands in T173 — not here.

-- 1. Column -----------------------------------------------------------------
ALTER TABLE set_logs
  ADD COLUMN workout_exercise_id uuid
    REFERENCES workout_exercises(id) ON DELETE SET NULL;

CREATE INDEX idx_set_logs_workout_exercise_logged_at
  ON set_logs (workout_exercise_id, exercise_id, logged_at DESC)
  WHERE workout_exercise_id IS NOT NULL;

-- 2. Eager unambiguous backfill (solos only) ---------------------------------
-- Attach only when the session's day has exactly one workout_exercises row
-- for that catalog exercise_id. Ambiguous / block / no-day rows stay NULL.
WITH day_slot_counts AS (
  SELECT
    workout_day_id,
    exercise_id,
    (array_agg(id ORDER BY sort_order, id))[1] AS sole_we_id
  FROM workout_exercises
  GROUP BY workout_day_id, exercise_id
  HAVING COUNT(*) = 1
)
UPDATE set_logs sl
SET workout_exercise_id = dsc.sole_we_id
FROM sessions s
JOIN day_slot_counts dsc
  ON dsc.workout_day_id = s.workout_day_id
 AND dsc.exercise_id = sl.exercise_id
WHERE sl.session_id = s.id
  AND sl.block_exercise_id IS NULL
  AND sl.workout_exercise_id IS NULL
  AND s.workout_day_id IS NOT NULL;

-- 3. Redefine log_slot (generated expr cannot ALTER in place) ---------------
DROP INDEX IF EXISTS set_logs_session_slot_set_uniq;
ALTER TABLE set_logs DROP COLUMN log_slot;
ALTER TABLE set_logs
  ADD COLUMN log_slot uuid
    GENERATED ALWAYS AS (
      COALESCE(block_exercise_id, workout_exercise_id, exercise_id)
    ) STORED;
CREATE UNIQUE INDEX set_logs_session_slot_set_uniq
  ON set_logs (session_id, log_slot, set_number);
