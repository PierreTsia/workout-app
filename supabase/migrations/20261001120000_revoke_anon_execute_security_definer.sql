-- #444: `REVOKE ... FROM PUBLIC` does not remove Supabase's explicit `anon`
-- grant.
--
-- Supabase sets `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO
-- anon, authenticated, service_role` at project creation, so every fresh
-- CREATE FUNCTION receives an explicit `anon=X` ACL entry, separate from the
-- implicit PUBLIC one. `REVOKE ... FROM PUBLIC` removes only the latter. A
-- database rebuilt from migrations therefore leaves `anon` able to EXECUTE a
-- SECURITY DEFINER function, while prod — patched by hand during the #439
-- incident — does not. Not exploitable (the bodies fail closed for anon), but
-- an environment-reproducibility defect.
--
-- The SECURITY DEFINER functions that predate the #440 fix are already revoked
-- from anon by 20260802170000_secure_definer_rpcs.sql, which uses the correct
-- `REVOKE ALL ... FROM PUBLIC, anon;` form. The single effective definition
-- still missing it is get_translations_for_review: its own 20260802150000
-- migration revokes PUBLIC only, and nothing later repairs it. Rather than edit
-- already-applied history (which would drift from prod), this migration closes
-- that one gap. `anon` is never granted EXECUTE; `authenticated` and
-- `service_role` are never revoked.

REVOKE ALL ON FUNCTION get_translations_for_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_translations_for_review() TO authenticated, service_role;
