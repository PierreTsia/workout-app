-- Deleting a trained workout day CASCADE-deletes exercise_blocks. block_runs
-- used ON DELETE CASCADE on block_id, which wiped AMRAP history even though
-- the session row survives (workout_day_id SET NULL).
-- Same history-safe pattern as set_logs.block_exercise_id.

ALTER TABLE block_runs
  ALTER COLUMN block_id DROP NOT NULL;

ALTER TABLE block_runs
  DROP CONSTRAINT block_runs_block_id_fkey;

ALTER TABLE block_runs
  ADD CONSTRAINT block_runs_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES exercise_blocks(id)
    ON DELETE SET NULL;
