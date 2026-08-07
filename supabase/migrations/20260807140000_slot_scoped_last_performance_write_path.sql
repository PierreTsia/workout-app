-- #463 / ADR 0012 / T172 — Persist Exercise Slot on set_logs (write path).
--
-- Solo logs gain workout_exercise_id so Last Performance can scope by
-- Exercise Slot. log_slot widens to COALESCE(block_exercise_id,
-- workout_exercise_id, exercise_id) so two same-catalog solos in one session
-- no longer collide at upsert.
--
-- No eager historical backfill: post-delete uniqueness on a day is unknowable;
-- null FK → template bootstrap (Bugbot #464 + CI db reset). Forward writes set
-- the FK. RPC replace (get_last_performance_for_slots) lands in T173 — not here.

-- 1. Column -----------------------------------------------------------------
ALTER TABLE set_logs
  ADD COLUMN workout_exercise_id uuid
    REFERENCES workout_exercises(id) ON DELETE SET NULL;

CREATE INDEX idx_set_logs_workout_exercise_logged_at
  ON set_logs (workout_exercise_id, exercise_id, logged_at DESC)
  WHERE workout_exercise_id IS NOT NULL;

-- 2. No eager historical backfill -------------------------------------------
-- "Exactly one slot for this catalog exercise on the day *now*" is not proof
-- the day was unambiguous *when the log was written* — a deleted dual-intent
-- sibling would stamp the wrong history onto the survivor (Bugbot on #464 /
-- ADR 0012). Legacy solos stay NULL → engine bootstraps from Template
-- Prescription. Forward writes set workout_exercise_id from the live slot.

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
