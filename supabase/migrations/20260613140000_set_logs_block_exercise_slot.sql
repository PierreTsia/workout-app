-- Block-aware set logging (#351, ADR 0007).
--
-- Problem: the unique key (session_id, exercise_id, set_number) collides when
-- the same catalog exercise appears more than once in a session — two slots of
-- a circuit using push-ups, or a solo + a block sharing an exercise the same
-- day. Each round of a block writes set_number = round, so without a finer key
-- those rows clobber each other.
--
-- Fix: tag block logs with block_exercise_id and dedupe on a generated
-- log_slot = COALESCE(block_exercise_id, exercise_id). Solos keep
-- block_exercise_id NULL → log_slot = exercise_id → identical behavior.

ALTER TABLE set_logs
  ADD COLUMN block_exercise_id uuid
    REFERENCES block_exercises(id) ON DELETE CASCADE;

-- Replace the catalog-exercise unique constraint with a slot-based one.
ALTER TABLE set_logs
  DROP CONSTRAINT set_logs_session_exercise_set_uniq;

ALTER TABLE set_logs
  ADD COLUMN log_slot uuid
    GENERATED ALWAYS AS (COALESCE(block_exercise_id, exercise_id)) STORED;

CREATE UNIQUE INDEX set_logs_session_slot_set_uniq
  ON set_logs (session_id, log_slot, set_number);

-- Speeds up "logs for this block cell" lookups; partial since most rows are solos.
CREATE INDEX idx_set_logs_block_exercise
  ON set_logs (block_exercise_id)
  WHERE block_exercise_id IS NOT NULL;
