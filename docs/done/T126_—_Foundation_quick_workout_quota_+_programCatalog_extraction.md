# T126 — Foundation: `quick_workout` quota + per-source caps + `_shared/programCatalog.ts`

## Goal

Land all the shared infrastructure that the preview slice (T127) needs but isn't itself user-facing: extend `ai_generation_log.source` to include `'quick_workout'`, refactor `_shared/aiQuota.ts` from a single shared `QUOTA_REGULAR = 5` to a per-source cap map (so `quick_workout` can ship at 10/30 while `program` and `workout` keep 5/30), and extract the duplicated `fetchCatalog` / `fetchProfile` / `fetchRecentHistory` helpers from `embedded-agent` into `_shared/programCatalog.ts`. After this lands, T127 is unblocked and `embedded-agent` benefits immediately from the dedup (the existing TODO at `embedded-agent/index.ts:178-180` is closed).

Addresses **Epic Brief stories 16, 25** (quota source + cap) and the locked decisions in **ADR 0002 §4** (independent `quick_workout` source).

## Mode

**AFK** — pure infrastructure refactor, all decisions locked, verifiable via unit tests.

## Slice

migration → `_shared/aiQuota.ts` refactor → `_shared/programCatalog.ts` extraction → `embedded-agent/index.ts` migration → Vitest unit tests + Deno parity tests for hot helpers

## Dependencies

None.

## Scope

### 1. Migration: extend `chk_ai_generation_log_source`

```sql
-- supabase/migrations/<ts>_quick_workout_quota_source.sql
alter table ai_generation_log
  drop constraint chk_ai_generation_log_source;

alter table ai_generation_log
  add constraint chk_ai_generation_log_source
  check (source in ('program','workout','embedded_chat','embedded_draft','quick_workout'));
```

Pattern parity with `file:supabase/migrations/20260508155714_ai_generation_log_sources_embedded_agent.sql`. The `'workout'` value stays — historical rows from the soon-to-die `generate-workout` function keep their attribution. No backfill.

### 2. `_shared/aiQuota.ts` — per-source caps

| Change | Detail |
|---|---|
| Extend `AIGenerationSource` union | Add `"quick_workout"` |
| Replace shared `QUOTA_REGULAR = 5` (`file:supabase/functions/_shared/aiQuota.ts:10`) | New `QUOTA_REGULAR_BY_SOURCE: Record<AIGenerationSource, number>` map: `{ program: 5, workout: 5, embedded_chat: 40, embedded_draft: 3, quick_workout: 10 }` |
| Update `checkQuota` | Read `QUOTA_REGULAR_BY_SOURCE[source]` instead of the constant |
| Whitelisted cap | Stays a single shared `QUOTA_WHITELISTED = 5` — no change |

**Existing callers preserved**: `generate-program` and the legacy `generate-workout` both pass `source: "program"` / `source: "workout"`, both map to `5` in the new record — zero behavior change for them. `embedded-agent`'s `enforceProgramQuota` (`file:supabase/functions/embedded-agent/index.ts:126`) also still resolves to `5`.

The `embedded_chat` (40) and `embedded_draft` (3) entries are listed for completeness and consistency, but those quotas are enforced in `embedded-agent/quota.ts` (independent helper, not via `checkQuota`). They serve as documentation of the canonical caps and ensure the type union is exhaustive.

### 3. Extract `_shared/programCatalog.ts`

| File | Action |
|---|---|
| `file:supabase/functions/_shared/programCatalog.ts` | **NEW**: export `fetchCatalog(supabase, equipmentValues)`, `fetchProfile(supabase, userId)`, `fetchRecentHistory(supabase, userId)` with the existing types `CatalogExercise`, `UserProfile`, `RecentExercise`. |
| `file:supabase/functions/embedded-agent/index.ts` | Replace local `fetchCatalog` / `fetchProgramProfile` / `fetchRecentHistory` (lines 182-242) with imports from the shared module. Delete the inline copies. |
| `file:supabase/functions/generate-program/` | **UNTOUCHED** — intentional. Stays on its inline copy until #343 retires it (T129). Keeping #343 isolated; smaller diff, lower regression risk. |

**The TODO comment at `embedded-agent/index.ts:178-180`** ("Worth extracting to `_shared/programCatalog.ts` as a follow-up") is closed by this ticket.

### 4. Tests

| Layer | Coverage |
|---|---|
| Vitest — `aiQuota.test.ts` | New cases: `quick_workout` cap is 10/30; `program` / `workout` caps remain 5/30; whitelist cap remains 5/24h for all sources |
| Vitest — `programCatalog.test.ts` | Happy path for each helper with mocked Supabase client; mirror the existing test patterns from `embedded-agent`'s test fixtures |
| Existing `embedded-agent` tests | Continue to pass unchanged after the helper extraction (regression check) |
| Deno parity (hot helpers only) | If `aiQuota.ts` is exercised by Deno tests today, port the new cap map test to Deno |

## Out of Scope

- New Edge function `generate-quick-workout` (T127)
- New Edge function `commit-quick-workout` (T128)
- New MCP tool (T124)
- PWA changes (T127, T128)
- Migration of `generate-program` to use `_shared/programCatalog.ts` (intentional — leaves it alone for #343)
- Changing `embedded_chat` / `embedded_draft` cap enforcement (their helper stays in `embedded-agent/quota.ts`)

## Acceptance Criteria

- [ ] Migration `<ts>_quick_workout_quota_source.sql` applies cleanly on a fresh `supabase db reset`; CHECK constraint allows inserting a row with `source = 'quick_workout'`.
- [ ] `aiQuota.ts` exposes `QUOTA_REGULAR_BY_SOURCE` (or equivalent named export) with `program: 5, workout: 5, quick_workout: 10`; the shared `QUOTA_REGULAR = 5` constant is removed.
- [ ] `checkQuota(supabase, userId, email, "quick_workout")` returns `allowed: false` after 10 rows in the last 30 days; `checkQuota(supabase, userId, email, "program")` returns `allowed: false` after 5 rows (existing behavior preserved).
- [ ] `_shared/programCatalog.ts` exports `fetchCatalog`, `fetchProfile`, `fetchRecentHistory` with stable type exports; signatures match what `embedded-agent` and the upcoming `generate-quick-workout` will import.
- [ ] `embedded-agent/index.ts` no longer contains inline catalog/profile/history helpers; the TODO comment at lines 178-180 is removed (or replaced by a link to the shared module).
- [ ] All existing `embedded-agent` Vitest + Deno tests pass unchanged after the migration.
- [ ] `generate-program/index.ts` is **untouched** (verifiable by `git diff`); its tests still pass.
- [ ] New Vitest suite for the per-source cap map covers each `AIGenerationSource` value; new suite for `programCatalog` covers happy paths.

## References

- [Epic Brief — Quick Workout AI to Embedded Agent + MCP (#342)](./Epic_Brief_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — stories 16, 25
- [Tech Plan — Quick Workout AI to Embedded Agent + MCP (#342)](./Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — sections "Migration", "Key Decisions → Quota cap mechanism", "Modified files → _shared/aiQuota.ts", "New files → _shared/programCatalog.ts"
- [ADR 0002 — Quick Workout AI MCP migration](./adr/0002-quick-workout-ai-mcp-migration.md) — §4 (independent quota + cap rationale)
- Reference migration: `file:supabase/migrations/20260508155714_ai_generation_log_sources_embedded_agent.sql`
- Code to extract: `file:supabase/functions/embedded-agent/index.ts:178-242`
