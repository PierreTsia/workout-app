-- Embedded Agent onboarding thread persistence — Phase B of epic #295 (T116).
-- See docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_B.md
-- and docs/CONTEXT.md (Embedded Agent thread, lifecycle, retention).
--
-- Lifecycle: open → preview_ready → committed | abandoned.
-- Hybrid transcript: raw `messages` while active; on commit we keep a
-- deterministic summary and clear `messages`. Lazy 7d staleness + 90d
-- retention purge run server-side on every thread touch (no Supabase cron).
--
-- !! INVARIANTS
-- 1. Account deletion: ON DELETE CASCADE on auth.users guarantees rows are
--    purged immediately when a user erases their account (Story 18). Do NOT
--    relax this — retention windows do not delay erasure.
-- 2. At most ONE active thread per user: the partial unique index below
--    enforces this. The threadStore module catches the 23505 collision and
--    resumes the existing row instead of throwing — multi-tab safe.
-- 3. RLS: every read/write must be user-scoped. The service role bypasses RLS
--    by design; reserve it for the Edge router's `delete-account`-style ops.

create table embedded_agent_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('open','preview_ready','committed','abandoned')),
  messages jsonb,
  last_preview jsonb,
  locale text check (locale in ('en','fr')),
  program_id uuid references programs(id) on delete set null,
  summary text,
  user_turn_count int not null default 0,
  assistant_turn_count int not null default 0,
  draft_count_24h int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz,
  abandoned_at timestamptz
);

-- One active onboarding thread per user. NULL-safe partial index.
create unique index embedded_agent_threads_one_active_per_user
  on embedded_agent_threads (user_id)
  where status in ('open','preview_ready');

-- Lookup helpers for the lazy retention sweep + per-user reads.
create index idx_embedded_agent_threads_user_status
  on embedded_agent_threads (user_id, status);

create index idx_embedded_agent_threads_updated_at
  on embedded_agent_threads (updated_at);

alter table embedded_agent_threads enable row level security;

create policy "users read own threads"
  on embedded_agent_threads for select
  using (auth.uid() = user_id);

create policy "users insert own threads"
  on embedded_agent_threads for insert
  with check (auth.uid() = user_id);

create policy "users update own threads"
  on embedded_agent_threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own threads"
  on embedded_agent_threads for delete
  using (auth.uid() = user_id);
