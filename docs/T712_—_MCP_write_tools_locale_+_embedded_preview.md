# T712 — MCP write tools locale + embedded preview

## Goal

Fix the literal churn path: the dry-run preview a user sees right after creating a program.
`create_program` / `create_workout_day` accept an optional `locale` that localizes **only**
the `rendered` echo, and the embedded-agent driver passes the thread locale so the preview
comes back in the athlete's language. The persisted `name_snapshot` stays French (ADR 0010).

Addresses Epic Brief stories: **1** (program preview in EN), **14** (no extra network, snapshot
unchanged).

## Mode

AFK.

## Slice

tool schema → handler → `lib/locale.ts` → `lib/daySequence.ts` → embedded driver
(`supabase/functions/embedded-agent/`) → golden fixture.

## Dependencies

T710 (`displayLabels.ts`, `locale.ts`, `name_en` on the wire).

## Scope

### `create_program`

- `file:supabase/functions/mcp/tools/createProgram.ts:56-137` — add optional `locale` to the
  schema; strip it before persistence (mirror `patchOnly()` in `updateProgram.ts:62-68`).
- Preview days (`:256-270`) and `buildDayRenderedLines` (`file:supabase/functions/mcp/lib/daySequence.ts:89-97`)
  use `resolveDisplayName(ge.exercise, locale)` for the rendered lines only.
- `programPersistence.ts:160` (`name_snapshot: ge.exercise.name`) is **unchanged**.

### `create_workout_day`

- `file:supabase/functions/mcp/tools/createWorkoutDay.ts:180` — same `locale` + `resolveDisplayName`.

### Embedded-agent driver

Pass the thread locale into the `create_program` dry-run so
`extractRenderedFromMcpResult` (`file:supabase/functions/embedded-agent/draft.ts:265`) lifts
language-correct lines. No change to the parser or the preview component.

## Out of Scope

- Client-side re-render of the preview.
- Localizing snapshots.
- Read tools (T711) / history (T714) / ranking (T715).

## Acceptance Criteria

- [ ] `create_program` and `create_workout_day` declare an optional `locale` enum.
- [ ] An `en` caller's dry-run `rendered` is EN (golden fixture).
- [ ] The persisted `name_snapshot` / `exercise_name_snapshot` remain the frozen French `name` (test).
- [ ] The persisted program payload contains no `locale` key (test).
- [ ] The embedded-agent `/draft` preview shows EN names for an `en` thread (fixture).
- [ ] No additional network request on the preview path (query-count assertion).

## References

- Tech Plan `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md`
- ADR 0010 `file:docs/adr/0010-localize-catalog-at-display-time.md`
