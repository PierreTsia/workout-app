-- Repair migration #373's pollution of set_logs.prescribed_*.
-- See ADR 0006 + issue #381 + PR #375.
--
-- Migration 20260527150000 backfilled `workout_exercises.template_updated_at
-- = now()` on every row. The Manual Override Window logic in buildPrescription
-- compares this against the previous session's finished_at; on the first
-- post-migration session for every user, template_updated_at (= migration
-- time) was strictly greater than any prior session.finished_at, which
-- forced the override window OPEN and made the engine read currentWeight
-- from `workout_exercises.weight` (= old conservative template defaults)
-- instead of the freshly-backfilled snapshot. That bad suggestion was then
-- written into `set_logs.prescribed_*` for every set logged in that session,
-- and propagates forward via subsequent previews.
--
-- Two coordinated repairs:
--   1. Reset workout_exercises.template_updated_at to a stable past date
--      so the override window stays closed by default. The trigger from
--      migration 20260527150000 re-stamps it to now() on real edits.
--   2. Re-apply the eager backfill (prescribed_* = logged values) on
--      set_logs from sessions that finished after the migration ran,
--      guarded to skip rows where prescribed_weight already matches
--      weight_logged (no-op or already-correct).

DO $$
DECLARE
  cutoff timestamptz;
  repaired_count integer;
BEGIN
  -- Step 1: snapshot the migration's footprint, then reset.
  --
  -- MIN(template_updated_at) is the best in-band estimate of when migration
  -- #373 actually ran in this environment (filename timestamp lies if the
  -- migration was applied late). We capture it BEFORE wiping, then use it
  -- as the cutoff for which sessions are potentially polluted.
  SELECT MIN(template_updated_at) INTO cutoff FROM workout_exercises;
  RAISE NOTICE '[repair] migration #373 cutoff captured: %', cutoff;

  UPDATE workout_exercises
  SET template_updated_at = '1970-01-01'::timestamptz;

  -- Step 2: repair polluted set_logs.
  --
  -- prescribed_sets uses COUNT(*) OVER (PARTITION BY ...) — single CTE pass,
  -- joined back by id. Same shape as the original migration's eager backfill
  -- but scoped to post-cutoff sessions only.
  --
  -- The diff-only guard (prescribed_weight IS DISTINCT FROM weight_logged)
  -- spares rows that are already correct or where the engine's prescription
  -- matched the user's actuals exactly. It does mean that a row in the
  -- polluted window with a *legitimate* HOLD_INCOMPLETE shape (engine
  -- prescribed X, user only did Y < X) will be repaired to (Y, Y), losing
  -- one signal — but the bug pattern produces uniform template values
  -- across all sets, so this trade-off is pragmatic.
  WITH set_counts AS (
    SELECT
      sl.id,
      COUNT(*) OVER (PARTITION BY sl.session_id, sl.exercise_id) AS set_count
    FROM set_logs sl
    JOIN sessions s ON s.id = sl.session_id
    WHERE s.finished_at IS NOT NULL
      AND s.finished_at >= cutoff
  )
  UPDATE set_logs sl
  SET
    prescribed_reps = CASE
      WHEN sl.duration_seconds IS NOT NULL THEN NULL
      WHEN sl.reps_logged IS NULL THEN NULL
      WHEN trim(sl.reps_logged) ~ '^[0-9]+$' THEN trim(sl.reps_logged)::integer
      ELSE NULL
    END,
    prescribed_weight = sl.weight_logged,
    prescribed_duration_seconds = sl.duration_seconds,
    prescribed_sets = sc.set_count::integer
  FROM set_counts sc
  WHERE sl.id = sc.id
    AND sl.prescribed_weight IS DISTINCT FROM sl.weight_logged;

  GET DIAGNOSTICS repaired_count = ROW_COUNT;
  RAISE NOTICE '[repair] set_logs repaired: % row(s)', repaired_count;
END $$;
