-- Triple Progression: add rep/set ranges, weight increment, and max-weight flag
-- to workout_exercises. See docs/Tech_Plan_—_Triple_Progression_Logic.md.

-- Step 1: Add columns (nullable temporarily for the backfill)
ALTER TABLE workout_exercises
  ADD COLUMN rep_range_min integer,
  ADD COLUMN rep_range_max integer,
  ADD COLUMN set_range_min integer,
  ADD COLUMN set_range_max integer,
  ADD COLUMN weight_increment numeric,
  ADD COLUMN max_weight_reached boolean NOT NULL DEFAULT false;

-- Step 2: Backfill from current reps/sets values.
-- Narrow range for low reps (strength), wider for high reps (endurance).
-- Non-numeric reps (e.g. "8-12" text) fall through to safe default 8-12.
UPDATE workout_exercises SET
  rep_range_min = CASE
    WHEN reps ~ '^\d+$' AND reps::int <= 6  THEN GREATEST(1, reps::int - 2)
    WHEN reps ~ '^\d+$' AND reps::int <= 12 THEN GREATEST(1, reps::int - 2)
    WHEN reps ~ '^\d+$'                      THEN GREATEST(1, reps::int - 3)
    ELSE 8
  END,
  rep_range_max = CASE
    WHEN reps ~ '^\d+$' AND reps::int <= 6  THEN reps::int + 1
    WHEN reps ~ '^\d+$' AND reps::int <= 12 THEN reps::int + 2
    WHEN reps ~ '^\d+$'                      THEN reps::int + 3
    ELSE 12
  END,
  set_range_min = GREATEST(1, sets - 1),
  set_range_max = LEAST(6, sets + 2);

-- Step 3: Enforce NOT NULL now that every row has values
ALTER TABLE workout_exercises
  ALTER COLUMN rep_range_min SET NOT NULL,
  ALTER COLUMN rep_range_max SET NOT NULL,
  ALTER COLUMN set_range_min SET NOT NULL,
  ALTER COLUMN set_range_max SET NOT NULL;

-- Step 4: Constraints
ALTER TABLE workout_exercises
  ADD CONSTRAINT we_rep_range_chk CHECK (rep_range_min <= rep_range_max),
  ADD CONSTRAINT we_set_range_chk CHECK (set_range_min <= set_range_max),
  ADD CONSTRAINT we_rep_range_positive CHECK (rep_range_min > 0),
  ADD CONSTRAINT we_set_range_positive CHECK (set_range_min > 0),
  ADD CONSTRAINT we_weight_increment_positive CHECK (weight_increment IS NULL OR weight_increment > 0);
