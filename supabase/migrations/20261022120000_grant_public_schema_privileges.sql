-- #712: a fresh `supabase db reset` left the public schema unusable.
--
-- The current Supabase CLI bootstrap no longer grants the classic project
-- privileges, and none of the 128 migrations in this repo ever granted them at
-- the table level. A database rebuilt from migrations therefore had
-- `anon`/`authenticated`/`service_role` with DELETE/TRUNCATE/REFERENCES but no
-- SELECT/INSERT/UPDATE on `public` tables — the app could not read or write.
-- Prod still carries the full `arwdDxtm` ACL because it was built by older CLI
-- versions that granted everything; this migration reproduces that state and
-- pins the default privileges so the next table-creating migration does not
-- reintroduce the gap.
--
-- Routines go to `authenticated` and `service_role` only: `anon` must never
-- receive EXECUTE, or the #444 sweep that revoked it from the SECURITY DEFINER
-- functions would be undone.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to authenticated, service_role;
