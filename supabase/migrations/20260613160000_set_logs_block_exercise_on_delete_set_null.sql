-- History must survive template edits (#351, ADR 0007, T143).
--
-- The previous migration (20260613140000) attached set_logs.block_exercise_id
-- with ON DELETE CASCADE. That means deleting a circuit (block_exercises row)
-- in the Builder would *delete the set_logs of past sessions* that used it —
-- silently destroying workout history. Logged history must be immutable.
--
-- Fix: switch to ON DELETE SET NULL. Removing a block from the template now
-- orphans its past logs (block_exercise_id → NULL); the generated
-- log_slot recomputes to exercise_id and the History view falls back to a flat
-- solo display (snapshots like exercise_name_snapshot are preserved on the row).

ALTER TABLE set_logs
  DROP CONSTRAINT set_logs_block_exercise_id_fkey;

ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_block_exercise_id_fkey
    FOREIGN KEY (block_exercise_id)
    REFERENCES block_exercises(id)
    ON DELETE SET NULL;
