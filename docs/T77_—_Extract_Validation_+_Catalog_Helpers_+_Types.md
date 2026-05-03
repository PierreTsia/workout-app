# T77 — Extract Validation + Catalog Helpers + Types

## Goal

Pure refactor: extract three pieces from `createProgram.ts` into shared modules so that `update_program` (T81) can import them without code duplication and create + update stay in lockstep on validation semantics. This ticket adds NO new behavior — its acceptance criterion is *zero behavior change for `create_program`*. It also seeds `lib/updateProgramTypes.ts` so T78 and T79 can be developed in parallel against a shared type contract.

Cites Epic Brief stories: **none directly** — this is plumbing that unblocks T78, T79, T80, T81. Without it, every downstream ticket either duplicates validation or coordinates ad-hoc on type shapes.

## Mode

**AFK.** Pure refactor with strict zero-behavior-change AC enforced by existing test suite. No design decisions.

## Slice

`tools/createProgram.ts` (refactor) → `lib/createProgramValidation.ts` (extension) → new `lib/catalogLookup.ts` → new `lib/updateProgramTypes.ts` → `lib/createProgramValidation.test.ts` (extended) → `lib/catalogLookup.test.ts` (new) → all existing tests stay green.

The "demoable" sliver is verifying that `create_program` continues to behave identically: any prompt that worked before T77 must produce the same DB rows after T77.

## Dependencies

**None.** Can run in parallel with T76, T78, T79, T80.

## Scope

### Three extractions

#### 1. `validateDayExercises` (extracted into `lib/createProgramValidation.ts`)

Currently inline in `tools/createProgram.ts` around lines 280-330: the per-day loop that calls `parseExerciseInput` per exercise, accumulates errors, and returns `ParsedExercise[]`.

New helper signature:

```ts
export function validateDayExercises(
  rawExercises: unknown[],
  dayLabel: string,
  catalogById: Map<string, CatalogExerciseForProgram>,
): { ok: true; parsed: ParsedExercise[] } | { ok: false; error: string }
```

Wraps:
1. Loop over `rawExercises`, call `parseExerciseInput` for each.
2. For each parsed exercise in object form, look up `catalogById.get(parsed.exerciseId)` and call `validateExerciseCrossFields(parsed, catalogExercise)`.
3. Accumulate first error encountered, return structured `error` string referencing `dayLabel` and exercise index.
4. On success, return `parsed` array.

Catalog is **passed in** by the caller (which batches the fetch across all days). This module does NOT call supabase.

#### 2. `fetchExercisesByIds` (extracted into new `lib/catalogLookup.ts`)

Currently lines 99-121 of `tools/createProgram.ts`. Direct lift, no logic change.

```ts
export async function fetchExercisesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<{ data: CatalogExerciseForProgram[]; error: string | null }>
```

- Single `IN (...)` query against `exercises` table.
- Maps rows via `catalogRowToExercise` (which itself stays in `createProgram.ts` as a local helper UNLESS it's needed by `update_program` too — verify during refactor; if needed, also extract to `catalogLookup.ts`).
- Error message names missing ids if any: `"Unknown or inaccessible exercise_id(s): ..."`.

#### 3. `lib/updateProgramTypes.ts` (new file, types-only)

Hosts the shared types that T78 (`updateProgramDiff`) and T79 (`updateProgramValidation`) both depend on. Types only, zero runtime code.

```ts
import type { ParsedExercise } from "./createProgramValidation.ts"

export interface CurrentProgramSnapshot {
  id: string
  name: string
  days: Array<{
    id: string
    label: string
    emoji: string
    sort_order: number
    workout_exercises: Array<{
      exercise_id: string
      name_snapshot: string
      sets: number
      reps: string
      weight: string
      rest_seconds: number
      target_duration_seconds: number | null
      sort_order: number
    }>
  }>
}

export interface ParsedPatchDay {
  id?: string                        // present → UPDATE; absent → INSERT
  label: string
  emoji?: string
  parsed_exercises: ParsedExercise[]  // already validated
}

export interface ParsedPatch {
  program_id: string
  name?: string
  days?: ParsedPatchDay[]
  dry_run: boolean                    // resolved (default true)
  confirm: boolean                    // resolved (default false)
}

export interface ProgramDiff {
  program_id: string
  name_change: { from: string; to: string } | null
  days_to_insert: Array<{
    label: string
    emoji?: string
    sort_order: number
    parsed_exercises: ParsedExercise[]
  }>
  days_to_update: Array<{
    id: string
    current: { label: string; emoji: string; sort_order: number }
    label: string
    emoji: string
    sort_order: number
    parsed_exercises: ParsedExercise[]
  }>
  days_to_delete: Array<{
    id: string
    label: string
    session_count: number   // populated post-FK-precheck (initially 0)
    blocking: boolean       // populated post-FK-precheck
  }>
  days_unchanged: Array<{ id: string; label: string }>
  apply_order: "default" | "insert_first"
}
```

### File-level summary

| File | Change |
|---|---|
| `supabase/functions/mcp/tools/createProgram.ts` | Remove inline validation loop (lines ~280-330) — replace with single call to `validateDayExercises(...)` per day. Remove inline `fetchExercisesByIds` (lines 99-121) — replace with import from `lib/catalogLookup.ts`. **Net LOC drop: ~80**. No behavior change. |
| `supabase/functions/mcp/lib/createProgramValidation.ts` | **Add** export `validateDayExercises`. All existing exports unchanged. |
| `supabase/functions/mcp/lib/catalogLookup.ts` | **New file.** Exports `fetchExercisesByIds`. ~30 LOC. |
| `supabase/functions/mcp/lib/updateProgramTypes.ts` | **New file.** Types-only: `CurrentProgramSnapshot`, `ParsedPatchDay`, `ParsedPatch`, `ProgramDiff`. ~50 LOC. Zero runtime code. |
| `supabase/functions/mcp/lib/createProgramValidation.test.ts` | **Add** direct tests for `validateDayExercises`: 1 happy path (mixed bare + object), 1 catalog miss, 1 cross-field rejection (bodyweight + weight_kg). |
| `supabase/functions/mcp/lib/catalogLookup.test.ts` | **New file.** 1 happy path (returns mapped rows), 1 missing-id case (returns error naming missing ids). |

### What does NOT move

- `parseExerciseInput`, `validateExerciseCrossFields`, `parseRepsBounds`, `BOUNDS`, `detectLegacyExerciseIds`, `LEGACY_MIGRATION_ERROR_MESSAGE` — stay where they are in `createProgramValidation.ts`. `validateDayExercises` is added alongside.
- `catalogRowToExercise` — stays local to `createProgram.ts` UNLESS the refactor reveals `update_program` needs it directly. Default: keep local; T81 will surface if a move is needed.
- `geFromParsed` / `geFromParsedObject` / `defaultGeneratedExercise` — stay local to `createProgram.ts` (they convert ParsedExercise → GeneratedExerciseForProgram for create's specific persistence path; update_program uses a different path via `applyDayUpdate`).

## Out of Scope

- Renaming `createProgramValidation.ts` to `programValidation.ts` (deferred yak-shaving per Epic Brief).
- Modifying any signature of `parseExerciseInput`, `validateExerciseCrossFields`, etc.
- Adding any new validation rule to `create_program`.
- Implementing anything in `lib/updateProgramTypes.ts` beyond type declarations.
- Touching `programPersistence.ts` (T80's territory).

## Acceptance Criteria

- [ ] `createProgram.ts` no longer contains the inline per-day validation loop nor the inline `fetchExercisesByIds`. Both call sites delegate to imported helpers.
- [ ] `lib/catalogLookup.ts` exists with `fetchExercisesByIds` exported and a minimal test (happy + missing-id).
- [ ] `lib/createProgramValidation.ts` exports `validateDayExercises` with the documented signature; direct tests cover happy path + catalog miss + cross-field rejection.
- [ ] `lib/updateProgramTypes.ts` exists as a types-only module exporting `CurrentProgramSnapshot`, `ParsedPatchDay`, `ParsedPatch`, `ProgramDiff`.
- [ ] **Zero behavior change for `create_program`**: the existing `createProgramValidation.test.ts`, any `programPersistence.test.ts` cases, and any integration tests of `createProgram` pass unchanged after the refactor (no test assertion edits required for those suites).
- [ ] Demoable end-to-end: a `create_program` MCP call with any valid Epic-B-shaped input produces the same DB rows after T77 as before — verified by running the existing test suite green AND a manual smoke call (any one prompt from the existing SKILL.md examples).

## References

- Epic Brief: `file:docs/Epic_Brief_—_MCP_—_update_program_#280.md`
- Tech Plan: `file:docs/Tech_Plan_—_MCP_—_update_program_#280.md` ("Validation extraction" + "Catalog lookup extraction" Key Decisions; T2 in Implementation Sequence)
- Modified files: `file:supabase/functions/mcp/tools/createProgram.ts`, `file:supabase/functions/mcp/lib/createProgramValidation.ts`
- New files: `file:supabase/functions/mcp/lib/catalogLookup.ts`, `file:supabase/functions/mcp/lib/updateProgramTypes.ts`
