-- Allow orphan workout_days (quick workouts not attached to any program)
ALTER TABLE workout_days ALTER COLUMN program_id DROP NOT NULL;

-- Visual badge for programs saved from quick workouts
ALTER TABLE programs ADD COLUMN is_quick boolean NOT NULL DEFAULT false;
