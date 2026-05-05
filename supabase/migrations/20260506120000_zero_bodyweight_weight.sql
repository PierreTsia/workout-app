-- Issue #320 — `update_program` rejects valid edits when echoing legacy bodyweight prescriptions
-- with `weight_kg > 0`. Historical rows in `workout_exercises` carry positive weights for exercises
-- that the catalog now classifies as `equipment = 'bodyweight'` (either pre-T74 lax validation, or
-- catalog drift after the fact). The R1 cross-field rule (lib/createProgramValidation.ts) correctly
-- rejects those rows on every echoed update, leaving affected programs un-editable through the MCP.
--
-- Fix: zero out `weight` for every `workout_exercises` row whose linked exercise is currently
-- `equipment = 'bodyweight'` and whose stored weight casts to a positive number.
--
-- The cast is safe: `weight` is `text NOT NULL DEFAULT '0'` and is always written as a stringified
-- number by the persistence layer (see supabase/functions/mcp/tools/createProgram.ts). A pre-flight
-- audit on each environment should confirm:
--   SELECT DISTINCT weight FROM workout_exercises WHERE weight !~ '^[0-9]+(\.[0-9]+)?$';  -- expect 0 rows
--
-- Idempotent by construction: a second run finds zero matching rows because every previously affected
-- row now stores '0'. The R1 validator continues to enforce the invariant on new writes through the
-- MCP, so historical drift cannot reappear via that path.

UPDATE workout_exercises AS we
SET weight = '0'
FROM exercises AS e
WHERE we.exercise_id = e.id
  AND e.equipment = 'bodyweight'
  AND we.weight::numeric > 0;
