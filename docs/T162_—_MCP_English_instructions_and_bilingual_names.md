# T162 — MCP English instructions and bilingual names

## Goal

Close the last bilingual gap so agents see the same catalog language surface as the app: reviewed English instructions on `get_exercise_details`, and `**name** (name_en)` on program read tools (T153).

## Mode

**AFK** — pure formatters + select joins; no schema, no profile read.

## Slice

`resolveEnglishInstructions` + `formatBilingualExerciseName` → wire three tools → SKILL.md

## Dependencies

None. Catalog `instructions_en` is already backfilled (#436). T153 spec: `file:docs/T153_—_MCP_bilingual_exercise_names.md`.

## Scope

### Instructions

- `file:supabase/functions/mcp/lib/resolveInstructions.ts` mirrors `resolveExerciseInstructions(..., "en")` from `file:src/lib/catalogLabels.ts` (edge runtime cannot import `@/`).
- `file:supabase/functions/mcp/tools/getExerciseDetails.ts` formats the resolved block. Status ∈ {`clean`, `approved`} + section parity → English; else French.

### Names (T153)

- Shared `file:supabase/functions/mcp/lib/bilingualName.ts` used by search, resolve, program details, upcoming workouts.
- `get_program_details` / `get_upcoming_workouts` join `exercises(name, name_en)`; snapshot alone when the join misses.

### Documentation

- `file:skills/gymlogic-mcp/SKILL.md` documents both formats.

## Out of Scope

- Accept-Language / `user_profiles.locale` on MCP (T154 / v1.5).
- Muscle/equipment English labels in MCP (#423).

## Acceptance Criteria

- [ ] `get_exercise_details` serves reviewed English instructions; flagged/missing → French.
- [ ] `get_program_details` / `get_upcoming_workouts` render `**name** (name_en)`.
- [ ] Missing `name_en` → name alone, no empty parentheses.
- [ ] Shared formatter used by search / resolve / program tools.
- [ ] No profile read.
- [ ] SKILL.md updated.

## References

- Issue: [#450](https://github.com/PierreTsia/workout-app/issues/450)
- Epic: [#422](https://github.com/PierreTsia/workout-app/issues/422)
- Prior: #417 (closed), #436 (instructions pipeline)
