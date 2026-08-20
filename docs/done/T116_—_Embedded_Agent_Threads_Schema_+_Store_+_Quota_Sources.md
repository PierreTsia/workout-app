# T116 — Embedded Agent Threads Schema + Store + Quota Sources

## Goal

Foundation slice for **Phase B** of Epic **#295**. Land the `**embedded_agent_threads`** table (with **RLS**, partial unique index, FK CASCADE), the `**threadStore`** module that owns thread CRUD + lifecycle (resume / abandon / 7d staleness / 90d body purge), and extend `**AIGenerationSource**` + the `ai_generation_log.source` CHECK constraint so future tickets can log billable **Embedded Agent** turns + drafts.

No Edge route, no UI — this is the foundation T117 → T120 build on, in the same spirit as **T113** in Phase A.

Addresses Epic Brief stories: **#10**, **#11**, **#12**, **#13**, **#17**, **#18**, **#19** (foundation only).

## Mode

**AFK** — schema + decisions are locked in `file:docs/CONTEXT.md` and the Phase B Tech Plan.

## Slice

`migration → threadStore.ts → Deno tests (RLS + lifecycle + retention)`

## Dependencies

None.

## Scope

### Migration — `*_create_embedded_agent_threads.sql`

- Table:
  ```sql
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
  ```
- **Partial unique index** to enforce one active onboarding thread per user:
  ```sql
  create unique index embedded_agent_threads_one_active_per_user
    on embedded_agent_threads (user_id)
    where status in ('open','preview_ready');
  ```
- Helper indexes: `(user_id, status)`, `(updated_at)` for retention sweeps.
- **RLS:** enable RLS; `user_id = auth.uid()` for `select`/`insert`/`update`/`delete`.
- `updated_at` trigger (reuse the project's standard `set_updated_at` pattern if present).

### Migration — `*_ai_generation_log_sources_embedded_agent.sql`

- Drop existing `chk_ai_generation_log_source` and recreate with the extended set:
  ```sql
  alter table ai_generation_log
    drop constraint chk_ai_generation_log_source;

  alter table ai_generation_log
    add constraint chk_ai_generation_log_source
    check (source in ('program','workout','embedded_chat','embedded_draft'));
  ```
- The existing `(user_id, source, created_at desc)` index already covers the new sources.

### TypeScript — `file:supabase/functions/_shared/aiQuota.ts`

- Extend `AIGenerationSource` union:
  ```ts
  export type AIGenerationSource = "program" | "workout" | "embedded_chat" | "embedded_draft"
  ```
- No behavior change in `checkQuota` — caps for the new sources are wired in **T118** / **T119**.

### `file:supabase/functions/embedded-agent/threadStore.ts`


| Function                                            | Purpose                                                                                                                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getOrCreateActiveThread(supabase, userId, locale)` | Loads the user's row in `status ∈ ('open','preview_ready')`. If none, inserts an `open` row. Returns `{ thread, resumed: boolean }`.                                                                                                          |
| `appendMessage(supabase, threadId, role, content)`  | Pushes a `{ role, content, ts }` object into `messages` JSONB; bumps the matching `*_turn_count`; bumps `updated_at`.                                                                                                                         |
| `setStatus(supabase, threadId, status, patch?)`     | Transitions to `preview_ready` / `committed` / `abandoned`; for `committed` writes `committed_at`, `program_id`, deterministic `summary`, and **clears** `messages` (privacy-first hybrid transcript); for `abandoned` writes `abandoned_at`. |
| `setLastPreview(supabase, threadId, preview)`       | Stores `last_preview` JSON; size guard noted in T119.                                                                                                                                                                                         |
| `markStale(supabase, threadId)`                     | Lazy 7d staleness check: if `updated_at < now − 7d` and status is `open`, transition to `abandoned` and return the abandoned thread.                                                                                                          |
| `purgeRetentionIfDue(supabase, threadId)`           | Lazy 90d body purge: if `committed_at` or `abandoned_at` < now − 90d and `messages` is not null, set `messages = null`.                                                                                                                       |


- All functions use the **user-scoped** Supabase client (RLS-enforced) — never the service client — so misuse can't leak cross-user data. Tests must verify this.

### Tests — `file:supabase/functions/embedded-agent/threadStore_test.ts`

- `getOrCreateActiveThread` creates on first call, resumes on second call, never returns more than one active row even under concurrent inserts (partial unique catches it).
- Trying to insert a second `open` thread raises a unique-violation that the helper translates to "resume the existing one".
- `setStatus("committed")` clears `messages` and writes `committed_at` + `summary`.
- `setStatus("abandoned")` writes `abandoned_at`.
- `markStale` on a 7d+1 thread → `abandoned`; on a 6d thread → unchanged.
- `purgeRetentionIfDue` on a 90d+1 committed thread clears `messages`; on a 89d thread it's a no-op.
- RLS test: a different user's session cannot read or update another user's thread row.

### Tests — `file:supabase/functions/_shared/aiQuota_test.ts` (new or extended)

- `AIGenerationSource` literal union accepts the new values (type-level test via `satisfies`).
- An `ai_generation_log` insert with `source = 'embedded_chat'` succeeds; with `source = 'bogus'` fails the CHECK.

## Out of Scope

- No Edge function routes (T117 lands `/thread`, T118–T120 land the rest).
- No quota enforcement logic for the new sources (T118 + T119).
- No UI work (T117).
- No structured-logging hardening (T122).

## Acceptance Criteria

- Migration creates `embedded_agent_threads` with RLS enabled and partial unique on `(user_id) where status in ('open','preview_ready')`.
- `embedded_agent_threads.user_id` cascades on `auth.users` delete (Story 18).
- `ai_generation_log.source` CHECK accepts `program`, `workout`, `embedded_chat`, `embedded_draft`.
- `threadStore` exports the seven helpers above and all use the user-scoped Supabase client.
- Deno tests cover: get/resume, partial unique, status transitions (`committed` purges `messages`, `abandoned` writes `abandoned_at`), 7d staleness, 90d retention purge.
- RLS test: foreign-user session cannot read/update the row.
- `AIGenerationSource` TS union extended; nothing in existing code regresses (`generate-program` and `generate-workout` still type-check).
- No app/frontend code changes.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md`
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_B.md` — Data Model section
- Glossary: `file:docs/CONTEXT.md` — `Embedded Agent thread`, `Embedded Agent thread lifecycle`, `Embedded Agent thread retention`
- Existing quota source migration: `file:supabase/migrations/20260321200000_ai_generation_log_source.sql`

