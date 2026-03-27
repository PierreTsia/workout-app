-- Duration progression: add duration range + increment to workout_exercises.
-- Nullable: only meaningful for duration exercises; reps exercises ignore them.
-- See docs/Tech_Plan_—_Generalized_Progression_Engine.md

ALTER TABLE workout_exercises
  ADD COLUMN duration_range_min_seconds integer,
  ADD COLUMN duration_range_max_seconds integer,
  ADD COLUMN duration_increment_seconds integer;

-- Backfill duration exercises from catalog defaults.
-- Formula: target ± band, floor at 5s for min.
UPDATE workout_exercises we SET
  duration_range_min_seconds = GREATEST(5, COALESCE(we.target_duration_seconds, e.default_duration_seconds, 30) - 10),
  duration_range_max_seconds = COALESCE(we.target_duration_seconds, e.default_duration_seconds, 30) + 15,
  duration_increment_seconds = 5
FROM exercises e
WHERE we.exercise_id = e.id
  AND e.measurement_type = 'duration';

-- Constraints
ALTER TABLE workout_exercises
  ADD CONSTRAINT we_duration_range_chk
    CHECK (duration_range_min_seconds IS NULL OR duration_range_min_seconds > 0),
  ADD CONSTRAINT we_duration_range_max_chk
    CHECK (duration_range_max_seconds IS NULL OR duration_range_max_seconds > 0),
  ADD CONSTRAINT we_duration_range_order_chk
    CHECK (duration_range_min_seconds IS NULL OR duration_range_max_seconds IS NULL
           OR duration_range_min_seconds <= duration_range_max_seconds),
  ADD CONSTRAINT we_duration_increment_chk
    CHECK (duration_increment_seconds IS NULL OR duration_increment_seconds > 0);
