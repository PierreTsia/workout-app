-- block_runs is AMRAP-only (Tours never writes a row). Match exercise_blocks
-- cap bounds so a bad client cannot persist a Tours run or an out-of-range cap.

ALTER TABLE block_runs DROP CONSTRAINT IF EXISTS block_runs_mode_check;

ALTER TABLE block_runs
  ADD CONSTRAINT block_runs_mode_amrap CHECK (mode = 'amrap');

ALTER TABLE block_runs
  ADD CONSTRAINT block_runs_cap_seconds_range
    CHECK (cap_seconds >= 60 AND cap_seconds <= 3600);
