# T711 — MCP read tools locale

## Goal

Give the MCP **read/format** tools an optional `locale` argument so a third-party agent (or a
French athlete) gets user-facing labels and muscle names in the requested language.

Addresses Epic Brief stories: **5** (read tools), **8, 9** (locale contract), **11** (muscle
labels localized, MCP side).

## Mode

AFK.

## Slice

tool JSON schema → `lib/locale.ts` → `lib/format.ts` → `lib/catalogLookup.ts` (name_en) →
golden fixture per tool.

## Dependencies

T710 (`displayLabels.ts`, `locale.ts`, `name_en` on the wire).

## Scope

### Tools

Add an optional `locale` property (`enum ["en","fr"]`) to the input schema and read the
profile locale via `resolveToolLocale`, for:

| Tool | File | Formatter |
|---|---|---|
| `get_upcoming_workouts` | `file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts` | `formatWorkoutDay` |
| `get_training_stats` | `file:supabase/functions/mcp/tools/getTrainingStats.ts` | `formatStatsSummary` |
| `get_program_details` | `file:supabase/functions/mcp/tools/getProgramDetails.ts` | `displayExerciseName` |

### `format.ts` threading

- `displayExerciseName` (`:392`), `formatSoloDetailsLine` (`:456`), `formatWorkoutDay`
  (`:531`), `formatStatsSummary` (`:350`), `formatAmrapScoreLines` (`:206`) take a `locale`
  (default `"en"`).
- Exercise names via `resolveDisplayName`; muscle labels via `muscleLabel`;
  `formatAmrapScoreLines` emits the FR gloss only for `fr`.
- `get_training_stats.ts:29` description no longer tells the agent to pass a French muscle
  name; it accepts the localized label.

### `bilingualName.ts`

`file:supabase/functions/mcp/lib/bilingualName.ts` (French-first `**FR** (EN)`) is **retired**
for these outputs in favour of `resolveDisplayName`. Repoint its remaining callers (search /
resolve output is T715) or delete it here; leave no French-first display path behind.

## Out of Scope

- `update_program` (already has `locale`, extended in T710).
- `get_workout_history` (T714); `search_exercises` / `resolve_exercises` (T715).
- Write tools (T712).

## Acceptance Criteria

- [ ] Each of the three tools declares an optional `locale` enum in its schema.
- [ ] An `en` caller gets EN exercise names **and** EN muscle labels from all three (golden fixtures through the real formatters).
- [ ] A `fr` caller's output is unchanged vs today (golden fixtures).
- [ ] Omitting `locale` with a NULL profile locale falls back to `en`.
- [ ] Passing `locale` never alters any written row.

## References

- Tech Plan `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md`
- ADR 0035 (T709)
