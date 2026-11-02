# T715 — Search and resolve ranking locale

## Goal

Make `search_exercises` and `resolve_exercises_batch` rank the caller's locale first, so
"bench press" beats "Développé couché" for an English agent. This pulls ADR 0010 §37's
deferred second phase into scope.

Addresses Epic Brief stories: **12** (ranking), **8, 9** (locale contract).

## Mode

AFK.

## Slice

new migration (RPC redefine) → RPC → MCP handler (`locale`) → arch test + golden fixture.

## Dependencies

T709 (ADR 0035), T710 (`locale.ts`).

## Scope

### Migration

New file `supabase/migrations/{ts}_search_and_resolve_locale.sql` redefining **in place**:

```sql
create or replace function public.search_exercises(..., locale text default 'en') ...
-- CASE boost: locale='en' → name_en ranks 0, name ranks 1 ; locale='fr' → inverse
```

`resolve_exercises_batch` mirrors it (`locale text default 'en'`). Neither applied migration
is edited (drift guard).

### Handlers

- `file:supabase/functions/mcp/tools/searchExercises.ts:168` — pass the resolved `locale`.
- `file:supabase/functions/mcp/tools/resolveExercises.ts:91` — same.
- Add the optional `locale` enum to both schemas.

### Migration history

Do **not** edit `20260326120000_search_exercises.sql`, `20260506000736` or
`20260506004927` — the cap-size variant is the signature precedent, not the target.

## Out of Scope

- Fuzzy-similarity re-rank (stays symmetric — accepted in the Tech Plan).
- Renaming any muscle values.

## Acceptance Criteria

- [ ] Both RPCs accept `locale text default 'en'`.
- [ ] An `en` query ranks the EN-matching row first; a `fr` query ranks the FR row first (golden fixture).
- [ ] Calling either RPC without `locale` behaves exactly as today (no regression).
- [ ] `securityDefiner.arch.test.ts` / the drift guard pass with the new migration.
- [ ] Both tool schemas declare the optional `locale` enum.

## References

- Tech Plan `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md` (Data Model)
- ADR 0010 `file:docs/adr/0010-localize-catalog-at-display-time.md` §37
