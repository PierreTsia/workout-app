-- Editing a program (drop a day) must not be blocked by historical sessions.
-- sessions already carry workout_label_snapshot; set_logs keep the actual work.
-- Same history-safe pattern as set_logs.block_exercise_id / workout_exercise_id.
--
-- Previous behavior: REFERENCES with no ON DELETE (NO ACTION). Postgres refused
-- to delete a workout_days row while any session pointed at it — including
-- finished sessions from past cycles. That made trained days undeletable.

ALTER TABLE sessions
  DROP CONSTRAINT sessions_workout_day_id_fkey;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_workout_day_id_fkey
    FOREIGN KEY (workout_day_id)
    REFERENCES workout_days(id)
    ON DELETE SET NULL;
