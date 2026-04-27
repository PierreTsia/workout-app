-- Personal Access Tokens (PATs) — long-lived auth path for MCP clients.
-- See docs/Tech_Plan_—_Long-Lived_MCP_Auth_via_Personal_Access_Tokens.md
--
-- !! IMPORTANT — OPERATIONAL INVARIANTS
--
-- 1. PAT_PEPPER (env var on the mcp + create-pat Edge Functions) is the HMAC
--    key used to hash every plaintext token. It is treated as IMMUTABLE for
--    the life of v0. Rotating PAT_PEPPER invalidates every existing token in
--    this table (every stored hash becomes unverifiable). Equivalent to a
--    mass revoke. Do not rotate without preparing users via comms.
--
-- 2. last_used_at is updated by the mcp Edge Function via SERVICE-ROLE client
--    only — there is intentionally NO UPDATE RLS policy below. The
--    `authenticated` role has no UPDATE path on this table. This prevents
--    users from tampering with their own activity timestamps.

create table personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null,
  prefix text not null,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),

  unique (token_hash),
  unique (user_id, name)
);

create index idx_pat_user_id on personal_access_tokens (user_id);

alter table personal_access_tokens enable row level security;

create policy "users read own tokens"
  on personal_access_tokens for select
  using (auth.uid() = user_id);

create policy "users insert own tokens"
  on personal_access_tokens for insert
  with check (auth.uid() = user_id);

create policy "users delete own tokens"
  on personal_access_tokens for delete
  using (auth.uid() = user_id);

-- Intentionally no UPDATE policy. See invariant (2) above.
