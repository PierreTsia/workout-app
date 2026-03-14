TRUNCATE workout_days CASCADE;

ALTER TABLE workout_days
  ADD COLUMN program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE;

CREATE INDEX idx_workout_days_program_id ON workout_days(program_id);
