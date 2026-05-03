# T79 — updateProgramValidation Pure Module

## Goal

Implement the three pure validators that gate `update_program` input before any supabase write: (a) top-level patch shape parsing including the `is_active` rejection, (b) day identity rules (unknown ids, duplicates), (c) destructive-guard enforcement. All three return structured `{ ok, value } | { ok: false, error }` results. Each error message is purpose-crafted to guide the agent toward a fix without external doc lookup.

Cites Epic Brief stories: **#11 (dry_run default), #14 (confirm: true requirement), #15 (unknown day id), #17 (duplicate day id), #18 (≥1 day, ≥1 exo invariants)**.

## Mode

**AFK.** Pure functions, every error message is a fixture. No design judgement.

## Slice

`lib/updateProgramValidation.ts` (new) → `lib/updateProgramValidation.test.ts` (new vitest covering every error branch).

Not demoable end-to-end as user-facing — pure module. Demoable as: "every error message is exactly the wording expected by the agent (verified by string equality in tests)."

## Dependencies

**Soft dep on T77** for shared types (`ParsedPatch`, `ProgramDiff` from `lib/updateProgramTypes.ts`). Same coordination as T78. Can run in parallel with T78.

## Scope

### Three exported functions

#### 1. `parsePatchShape(args)` — top-level patch shape

```ts
export function parsePatchShape(
  args: Record<string, unknown>,
): { ok: true; value: ParsedPatch } | { ok: false; error: string }
```

Validates and normalizes the raw MCP `args` object into a `ParsedPatch`. Order of checks:

1. **`is_active` field rejection** (must come before generic "unknown field" check):
   - If `args.is_active !== undefined` → return error: *"`is_active` is not editable via update_program. Use the dedicated `set_active_program` tool (coming soon)."*
2. **`program_id`**:
   - Required. Must be a UUID (use existing `isUuid` helper from `lib/uuid.ts`).
   - Error: *"Invalid program_id format (expected UUID)."*
3. **`name`** (optional):
   - If present: must be a non-empty trimmed string.
   - Error: *"`name` must be a non-empty string when provided."*
4. **`days`** (optional):
   - If present: must be an array.
   - Length: 1 ≤ length ≤ 14.
   - Error (empty): *"`days` must be a non-empty array when provided. Omit the field entirely to leave days unchanged, or pass at least one day."*
   - Error (too many): *"days: too many entries (max 14)."*
   - Per-day shape:
     - `label` required, non-empty trimmed string. Error: *"days[i].label must be a non-empty string."*
     - `emoji` optional string.
     - `id` optional, must be UUID if present. Error: *"days[i].id must be a UUID when provided."*
     - `exercises` required array, length 1-40. Error: *"days[i].exercises must be a non-empty array (≥1 exercise per day)."* / *"days[i].exercises: too many entries (max 40)."*
     - **Note**: per-exercise validation is delegated to `validateDayExercises` (T77) — `parsePatchShape` only checks the array shape, not each exercise's contents.
5. **`dry_run`** (optional, default `true`):
   - If present: must be a boolean. Error: *"`dry_run` must be a boolean."*
6. **`confirm`** (optional, default `false`):
   - If present: must be a boolean. Error: *"`confirm` must be a boolean."*

Returns `ParsedPatch` with `dry_run` and `confirm` resolved to their default values when omitted, and per-day `parsed_exercises: []` placeholder (filled by handler after calling `validateDayExercises`).

#### 2. `validateDayIdentities(patchDays, currentDayIds)` — day identity rules

```ts
export function validateDayIdentities(
  patchDays: ParsedPatchDay[],
  currentDayIds: Set<string>,
): { ok: true } | { ok: false; error: string }
```

Two rules:

1. **No duplicate `id`** within the patch:
   - Walk `patchDays`, track seen ids in a `Set`.
   - On collision, error: *"days[<i>] and days[<j>] both reference id '<uuid>'. Each day id may appear at most once in the patch."*
2. **All provided `id`s exist in current program**:
   - For each `patchDays[i].id` (when defined), check it's in `currentDayIds`.
   - On miss, error: *"days[<i>].id '<uuid>' is not a day of the current program. Omit the id to create a new day, or check the id."*

Order: check duplicates first (cheaper); then check existence.

#### 3. `requireConfirmForDestructive(diff, confirm)` — destructive-guard

```ts
export function requireConfirmForDestructive(
  diff: ProgramDiff,
  confirm: boolean,
): { ok: true } | { ok: false; error: string }
```

If `diff.days_to_delete.length > 0` AND `confirm !== true`:
- Error: *"Patch removes <N> day(s): <comma-separated labels>. Pass `confirm: true` along with `dry_run: false` to apply, or revise the payload to keep these days."*

Otherwise `{ ok: true }`. (Note: `parsePatchShape` already enforces `confirm` is boolean. Here we just check truthiness.)

### `lib/updateProgramValidation.test.ts`

Vitest covering every error branch by exact string equality on the error message:

| Test | Function | Input | Expected error contains |
|---|---|---|---|
| is_active rejected | `parsePatchShape` | `{ program_id, is_active: true }` | `"set_active_program"` |
| invalid program_id | `parsePatchShape` | `{ program_id: "not-uuid" }` | `"expected UUID"` |
| empty name | `parsePatchShape` | `{ program_id, name: "" }` | `"non-empty string"` |
| days empty array | `parsePatchShape` | `{ program_id, days: [] }` | `"non-empty array"` |
| days too long | `parsePatchShape` | `{ program_id, days: [...15 entries] }` | `"max 14"` |
| day label missing | `parsePatchShape` | `{ program_id, days: [{ exercises: [] }] }` | `"days[0].label"` |
| day exercises empty | `parsePatchShape` | `{ program_id, days: [{ label: "X", exercises: [] }] }` | `"≥1 exercise"` |
| day id not uuid | `parsePatchShape` | `{ program_id, days: [{ id: "x", label: "Y", exercises: [...] }] }` | `"days[0].id must be a UUID"` |
| dry_run not bool | `parsePatchShape` | `{ program_id, dry_run: "yes" }` | `"must be a boolean"` |
| confirm not bool | `parsePatchShape` | `{ program_id, confirm: 1 }` | `"must be a boolean"` |
| happy path defaults | `parsePatchShape` | `{ program_id }` | `ok: true, value.dry_run === true, value.confirm === false` |
| duplicate day id | `validateDayIdentities` | `[{ id: "u1", ... }, { id: "u1", ... }]` | `"both reference id 'u1'"` |
| unknown day id | `validateDayIdentities` | `[{ id: "u-unknown", ... }]`, `currentDayIds: Set(["u1"])` | `"is not a day of the current program"` |
| confirm required | `requireConfirmForDestructive` | diff with `days_to_delete: [{label: "Cardio"}]`, `confirm: false` | `"Patch removes 1 day(s): Cardio"` |
| confirm provided | `requireConfirmForDestructive` | same diff, `confirm: true` | `ok: true` |
| no destructive | `requireConfirmForDestructive` | diff with `days_to_delete: []`, `confirm: false` | `ok: true` |

## Out of Scope

- Per-exercise validation (`parseExerciseInput`, `validateExerciseCrossFields`, `validateDayExercises`) — handled by T77's extractions, called by T81 handler.
- Diff computation — T78.
- FK pre-check / active cycle check — T81 handler.
- Catalog fetch — T77's extracted `fetchExercisesByIds`.
- Rendering errors as MCP `content[0].text` — T81 wraps these into the response shape.

## Acceptance Criteria

- [ ] `lib/updateProgramValidation.ts` exists, exports `parsePatchShape`, `validateDayIdentities`, `requireConfirmForDestructive` with the documented signatures.
- [ ] Every error message in this ticket's behavior table is verified by exact string match in a test.
- [ ] `parsePatchShape` happy path test asserts the resolved `dry_run: true` and `confirm: false` defaults.
- [ ] `is_active` rejection test asserts the error string contains `"set_active_program"` (NOT a generic "unknown field" message).
- [ ] All three functions return `{ ok: true, ... }` on valid input and `{ ok: false, error: <string> }` on invalid (no thrown errors, no nulls).
- [ ] `npm test -- updateProgramValidation` runs green in isolation.
- [ ] Demoable: a maintainer reading the test file can see, for every possible validation failure mode, the exact error string the agent will receive.

## References

- Epic Brief: `file:docs/Epic_Brief_—_MCP_—_update_program_#280.md` (Stories 11, 14, 15, 17, 18)
- Tech Plan: `file:docs/Tech_Plan_—_MCP_—_update_program_#280.md` ("lib/updateProgramValidation.ts" component description; T4 in Implementation Sequence)
- Shared types: `file:supabase/functions/mcp/lib/updateProgramTypes.ts` (created in T77)
- New files: `file:supabase/functions/mcp/lib/updateProgramValidation.ts`, `file:supabase/functions/mcp/lib/updateProgramValidation.test.ts`
