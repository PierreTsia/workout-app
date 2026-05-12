# T131 — Schema + thread store + hook API + quota bump

## Goal

Land the foundational multi-purpose plumbing for the Embedded Agent: schema migration (5 columns + relaxed partial unique index), `threadStore` API refactor to key on `(user_id, purpose)`, handler dispatch threading `purpose` through all 6 routes, React Query hook API change, and the `embedded_draft` quota cap bump from 3 → 10. **Onboarding behavior must be unchanged** — this ticket is the bedrock that lets T132/T133/T135 run in parallel.

Addresses Brief stories: **16** (per-row staleness), **24** (backfill via DEFAULT), **25** (atomic index swap), **26** (resume by `(user, purpose)`), **29** (quota bump). Plus Tech Plan's **Critical Constraints** on `embedded-agent/index.ts` deps + backward-compat default.

## Mode

**AFK** — bounded mechanical refactor with strong regression gate (onboarding E2E).

## Slice

migration → threadStore → handler dispatch → hook API → onboarding E2E regression gate

## Dependencies

- **T130** (`_shared/programDraft.ts` extraction)

## Scope

### 1. Schema migration

New file: `supabase/migrations/<ts>_embedded_agent_threads_multi_purpose.sql`

```sql
alter table embedded_agent_threads
  add column purpose text not null default 'onboarding'
    check (purpose in ('onboarding','additional_program')),
  add column change_motivation text
    check (change_motivation is null or change_motivation in (
      'variety','plateau','injury','priority_shift',
      'equipment_change','return_from_break','other'
    )),
  add column bundle_context jsonb,
  add column validator_rejection_count int not null default 0,
  add column pending_constraint_overrides jsonb;

drop index embedded_agent_threads_one_active_per_user;

create unique index embedded_agent_threads_one_active_per_purpose
  on embedded_agent_threads (user_id, purpose)
  where status in ('open','preview_ready');

create index idx_embedded_agent_threads_user_purpose_status
  on embedded_agent_threads (user_id, purpose, status);
```

Existing rows backfill to `purpose='onboarding'` via the DEFAULT clause; `change_motivation`, `bundle_context`, `pending_constraint_overrides` stay NULL on legacy rows; `validator_rejection_count` starts at 0 for everyone.

### 2. `threadStore.ts` API changes

| Symbol | Current signature | New signature |
|---|---|---|
| `getActiveThread` | `(supabase, userId)` | `(supabase, userId, purpose)` |
| `getOrCreateActiveThread` | `(supabase, userId, locale)` | `(supabase, userId, locale, purpose)` |
| `Thread` (type) | (existing fields) | + `purpose`, `change_motivation`, `bundle_context`, `validator_rejection_count`, `pending_constraint_overrides` |

New helpers (all take `(supabase, thread, ...)` for symmetry):

| Helper | Behavior |
|---|---|
| `setBundle(thread, bundle)` | UPDATE `bundle_context` only |
| `incrementValidatorRejection(thread)` | UPDATE `validator_rejection_count = validator_rejection_count + 1` |
| `setChangeMotivation(thread, motivation)` | UPDATE `change_motivation` only — caller must check it's not already set (first-accept-only is policy, helper itself is unconditional) |
| `setPendingConstraintOverrides(thread, overrides \| null)` | UPDATE `pending_constraint_overrides` |
| `consumePendingOverrides(thread)` | UPDATE `pending_constraint_overrides = NULL` (consumed-at-/draft idempotent) |

### 3. Handler dispatch

`handler.ts` action handlers all thread `purpose` through:

| Action body | Resolution |
|---|---|
| `{ action, purpose?, ... }` | If `purpose` missing → default `'onboarding'`, emit `warn` log with `error_kind: 'missing_purpose_default_applied'` (back-compat for stale-tab onboarding clients). |
| `purpose ∉ ('onboarding' \| 'additional_program')` | 400 `invalid_purpose`. |

All 5 call sites of `deps.getActiveThread(userId)` become `deps.getActiveThread(userId, purpose)`:
- `handleSend`
- `handleDraft`
- `handleReject`
- `handleCommit`
- `handleAbandon`

`handleOpen` already takes `locale`; threads `purpose` through to `getOrCreateActiveThread`.

### 4. Hook API change — `src/hooks/useEmbeddedAgentThread.ts`

Each hook takes `purpose` as a required first arg. Cache key becomes `['embedded-agent', 'thread', purpose]` so onboarding + additional-program have isolated React Query caches.

| Hook | Old signature | New signature |
|---|---|---|
| `useThread` | `(locale)` | `(purpose, locale)` |
| `useSendMessage` | `()` | `(purpose)` |
| `useGenerateDraft` | `()` | `(purpose)` |
| `useRejectPreview` | `()` | `(purpose)` |
| `useCommitPreview` | `()` | `(purpose)` |
| `useAbandonThread` | `()` | `(purpose)` |

`callEmbeddedAgent` body merges `purpose` into every action payload.

### 5. Quota bump

`supabase/functions/_shared/aiQuota.ts`:

```diff
 const QUOTA_REGULAR_BY_SOURCE: Record<AIGenerationSource, number> = {
   program: 5,
   workout: 5,
-  embedded_draft: 3,
+  embedded_draft: 10,
   embedded_chat: 40,
   quick_workout: 10,
 }
```

Inline comment cites this ticket / ADR 0003: engaged user creates ~6 programs/year × ~1.5 drafts each with regenerates ≈ ~9/year peak. 3/24h saturates fast for repeat creators; 10/24h leaves headroom while staying bounded.

### 6. Consumer update — `src/pages/OnboardingPage.tsx`

Update existing call sites:

```diff
- useThread(locale)
+ useThread('onboarding', locale)

- useSendMessage()
+ useSendMessage('onboarding')

// etc. for the other 4 hooks
```

No other UI changes. `CreateProgramPage` is NOT touched in this ticket (out of scope — T136 owns it).

## Out of Scope

- Additional-program prompt content / per-flow validators (T132 owns).
- Bundle builder (T133 owns).
- Component relocation (T135 owns).
- `CreateProgramPage` cutover (T136 owns).
- Hook factory pattern (`useEmbeddedAgentThread({ purpose })` returning a bound object) — explicitly rejected in Tech Plan; do NOT refactor toward this.
- Server-side analytics writes for new events (T136 fires client-side).

## Acceptance Criteria

- [ ] Migration file lives under `supabase/migrations/`, applies cleanly to a local Supabase reset.
- [ ] After migration on a fixture of representative rows (or staging copy): zero NULL `purpose` values; partial unique index allows two active threads per user when `purpose` differs; rejects duplicates within the same `purpose`.
- [ ] `threadStore.ts` unit tests pass with new signatures; verifies a `(user_id='X', purpose='onboarding')` thread does NOT collide with a `(user_id='X', purpose='additional_program')` thread on `getOrCreateActiveThread`.
- [ ] Handler unit tests for all 6 actions pass with `purpose` plumbed through; missing-purpose body defaults to `'onboarding'` and logs the back-compat warning.
- [ ] `useThread.test.ts` + sibling hook tests pass; cache key isolation verified (concurrent `useThread('onboarding')` and `useThread('additional_program')` queries produce two distinct cache entries).
- [ ] `QUOTA_REGULAR_BY_SOURCE.embedded_draft === 10` in `_shared/aiQuota.ts`; inline comment references this ticket.
- [ ] `e2e/onboarding.spec.ts` passes unchanged — non-negotiable regression gate.
- [ ] `OnboardingPage.tsx` consumers pass `purpose='onboarding'` to all hook calls.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 16, 24, 25, 26, 29)
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Data Model — Migration; Hook API change; Modified Files — threadStore + handler + hook)
- ADR 0004: `docs/adr/0004-embedded-agent-thread-purpose-column.md`
- Existing migration to mirror: `file:supabase/migrations/20260508155713_create_embedded_agent_threads.sql`
- Existing threadStore: `file:supabase/functions/embedded-agent/threadStore.ts`
- Existing hook: `file:src/hooks/useEmbeddedAgentThread.ts`
- Quota helper: `file:supabase/functions/_shared/aiQuota.ts`
