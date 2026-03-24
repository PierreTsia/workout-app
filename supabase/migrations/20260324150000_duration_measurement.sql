-- Duration-based exercises: measurement mode, template targets, set_logs duration column.
-- CHECK on set_logs uses NOT VALID first; validate after ensuring no violating legacy rows.

-- exercises
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS measurement_type text NOT NULL DEFAULT 'reps';

ALTER TABLE exercises
  DROP CONSTRAINT IF EXISTS exercises_measurement_type_chk;

ALTER TABLE exercises
  ADD CONSTRAINT exercises_measurement_type_chk
  CHECK (measurement_type IN ('reps', 'duration'));

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS default_duration_seconds integer;

ALTER TABLE exercises
  DROP CONSTRAINT IF EXISTS exercises_default_duration_seconds_chk;

ALTER TABLE exercises
  ADD CONSTRAINT exercises_default_duration_seconds_chk
  CHECK (default_duration_seconds IS NULL OR default_duration_seconds > 0);

-- workout_exercises
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS target_duration_seconds integer;

ALTER TABLE workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_target_duration_seconds_chk;

ALTER TABLE workout_exercises
  ADD CONSTRAINT workout_exercises_target_duration_seconds_chk
  CHECK (target_duration_seconds IS NULL OR target_duration_seconds > 0);

-- set_logs
ALTER TABLE set_logs ALTER COLUMN reps_logged DROP NOT NULL;

ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE set_logs
  DROP CONSTRAINT IF EXISTS set_logs_duration_seconds_chk;

ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_duration_seconds_chk
  CHECK (duration_seconds IS NULL OR duration_seconds > 0);

ALTER TABLE set_logs DROP CONSTRAINT IF EXISTS set_logs_reps_or_duration_chk;

ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_reps_or_duration_chk CHECK (
    (duration_seconds IS NULL AND reps_logged IS NOT NULL)
    OR (duration_seconds IS NOT NULL AND reps_logged IS NULL)
  ) NOT VALID;

ALTER TABLE set_logs VALIDATE CONSTRAINT set_logs_reps_or_duration_chk;
