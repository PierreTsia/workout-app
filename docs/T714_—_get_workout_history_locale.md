# T714 — get_workout_history locale

## Goal

`get_workout_history` returns English exercise names and its `exercise_name` filter matches
the caller's language, so an English athlete's query is not silently dropped.

Addresses Epic Brief stories: **4** (history + filter), **10** (retroactive correction).

## Mode

AFK.

## Slice

`file:supabase/functions/mcp/tools/getWorkoutHistory.ts` (select + filter) → `format.ts` →
golden fixture.

## Dependencies

T710 (`displayLabels.ts`, `name_en` on the wire).

## Scope

- `file:supabase/functions/mcp/tools/getWorkoutHistory.ts:102-108` — join `exercises(name, name_en)`
  or resolve per `exercise_id`.
- `:110-112` — the `exercise_name` filter matches the localized name for the caller's locale
  (fall back to snapshot so FR behaviour is unchanged).
- `:210-219` — `formatWorkoutHistory` renders via `resolveDisplayName`.
- Add optional `locale` to the schema + `resolveToolLocale`.

## Out of Scope

- Other read tools (T711); ranking (T715).

## Acceptance Criteria

- [ ] An `en` caller receives EN exercise names (golden fixture).
- [ ] An `en` query for the English name matches sets; an `fr` query for the French name still matches.
- [ ] A set whose catalog row is absent still shows via `exercise_name_snapshot`.
- [ ] Optional `locale` enum declared on the schema.

## References

- Tech Plan `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md`
- ADR 0035 (T709)
