-- #444: `REVOKE ... FROM PUBLIC` does not remove Supabase's explicit `anon`
-- grant.
--
-- Supabase sets `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO
-- anon, authenticated, service_role` at project creation, so every fresh
-- CREATE FUNCTION receives an explicit `anon=X` ACL entry, separate from the
-- implicit PUBLIC one. `REVOKE ... FROM PUBLIC` removes only the latter. A
-- database rebuilt from migrations therefore leaves `anon` able to EXECUTE the
-- SECURITY DEFINER functions, while prod — patched by hand during the #439
-- incident — does not. Not exploitable (the bodies fail closed for anon), but
-- an environment-reproducibility defect.
--
-- The seven functions that predate the #440 fix are already revoked from anon
-- by 20260802170000_secure_definer_rpcs.sql. The one effective definition still
-- missing it is get_translations_for_review, whose 20260802150000 migration
-- revokes PUBLIC only. Rather than edit already-applied history (which would
-- drift from prod), this migration re-asserts the end state for the whole
-- SECURITY DEFINER roster. Every statement is idempotent: re-revoking an
-- already-revoked grant and re-granting an already-granted one are no-ops.
--
-- `anon` is never granted EXECUTE. `authenticated` and `service_role` are never
-- revoked. validate_title_ownership is the exception to the GRANT below: it is
-- a trigger function, deliberately revoked from every role in 20260802170000,
-- and re-granting it would undo that decision for no caller.

-- ── check_and_grant_achievements ────────────────────────────────────
REVOKE ALL ON FUNCTION check_and_grant_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_and_grant_achievements(uuid) TO authenticated, service_role;

-- ── get_badge_status ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION get_badge_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_badge_status(uuid) TO authenticated, service_role;

-- ── get_cycle_stats ─────────────────────────────────────────────────
REVOKE ALL ON FUNCTION get_cycle_stats(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_cycle_stats(uuid, uuid) TO authenticated, service_role;

-- ── get_exercise_filter_options ─────────────────────────────────────
REVOKE ALL ON FUNCTION get_exercise_filter_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_exercise_filter_options() TO authenticated, service_role;

-- ── get_translations_for_review ─────────────────────────────────────
-- The gap this migration exists to close.
REVOKE ALL ON FUNCTION get_translations_for_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_translations_for_review() TO authenticated, service_role;

-- ── get_unreviewed_exercises_by_usage ───────────────────────────────
REVOKE ALL ON FUNCTION get_unreviewed_exercises_by_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_unreviewed_exercises_by_usage() TO authenticated, service_role;

-- ── get_volume_by_muscle_group ──────────────────────────────────────
REVOKE ALL ON FUNCTION get_volume_by_muscle_group(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_volume_by_muscle_group(uuid, int, int) TO authenticated, service_role;

-- ── validate_title_ownership ────────────────────────────────────────
-- Trigger function, revoked from every role on purpose. Revoke anon here for
-- completeness; do not grant it back.
REVOKE ALL ON FUNCTION validate_title_ownership() FROM PUBLIC, anon;
