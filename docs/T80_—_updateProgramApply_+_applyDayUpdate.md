# T80 — updateProgramApply + applyDayUpdate

## Goal

Implement the per-day apply orchestrator that walks a `ProgramDiff` and mutates supabase one day at a time, plus the low-level `applyDayUpdate` persistence helper that wipes-and-reinserts a single day's `workout_exercises`. Includes the smart-reorder escape hatch (insert-first when the patch would transit through a 0-days state) AND the partial-success report with the explicit retry guidance string. T80 is fully testable in isolation by constructing `ProgramDiff` instances manually and using a mock supabase — it does NOT depend on T78 at runtime.

Cites Epic Brief stories: **#10 (wipe-and-reinsert per touched day), #19 (mid-cycle warning passage — value passed through), #20 (warning passes to dry_run too — value passed through), #21 (partial-success report shape)**.

## Mode

**AFK.** All scenarios mechanically verifiable via mock supabase. No design judgement.

## Slice

`lib/programPersistence.ts` (extension: `applyDayUpdate`) → `lib/updateProgramApply.ts` (new orchestrator) → `lib/updateProgramApply.test.ts` (new vitest with mock supabase) → tests for `applyDayUpdate` separately.

Not demoable end-to-end as a user-facing change — pure orchestration. Demoable as: "given any `ProgramDiff`, apply succeeds and produces the documented `ApplyResult`, OR fails with a partial-success report carrying the retry guidance string verbatim."

## Dependencies

**Soft dep on T77** for shared types (`ProgramDiff` from `lib/updateProgramTypes.ts`). Can run in parallel with T78 and T79.

T80's tests construct `ProgramDiff` instances manually (no `computeProgramDiff` call). This is intentional — keeps T80 a true unit test of the orchestrator, decouples from T78's fixture format.

## Scope

### `lib/programPersistence.ts` extension

Add a single new exported helper. **Edge-only — no `src/lib/programPersistence.ts` mirror.**

```ts
export async function applyDayUpdate(
  supabase: SupabaseClient,
  dayId: string,
  parsedExercises: ParsedExercise[],
  catalogById: Map<string, CatalogExerciseForProgram>,
  userId: string,
): Promise<{ ok: true; inserted_count: number } | { ok: false; error: string }>
```

Implementation:

1. **DELETE `workout_exercises`** for the given `dayId` (RLS scopes to user).
   - On error, return `{ ok: false, error: <supabase error message> }`.
2. **Build insert rows**: convert `parsedExercises` to `GeneratedExerciseForProgram[]` using a local helper `geFromParsedForApply(parsed, catalogById)` (mirrors `geFromParsed` from `createProgram.ts` but lives here since it's apply-specific). Then call existing `buildWorkoutExerciseInsertRowsForDay(dayId, generated, userId)`.
3. **INSERT `workout_exercises`** in a single bulk insert.
   - On error, return `{ ok: false, error }`.
4. Return `{ ok: true, inserted_count: rows.length }`.

Local helper (private to programPersistence.ts):

```ts
function geFromParsedForApply(
  parsed: ParsedExercise,
  catalogById: Map<string, CatalogExerciseForProgram>,
): GeneratedExerciseForProgram {
  const catalogEx = catalogById.get(parsed.exerciseId)
  if (!catalogEx) throw new Error(`Catalog miss for exercise_id ${parsed.exerciseId}`)
  // Same logic as createProgram.ts:geFromParsed (bare → defaults, object → freeze)
}
```

(If T81 finds that `geFromParsed` from `createProgram.ts` is identical and callable from here, prefer the import. Otherwise local copy is fine — they're 20 LOC each.)

### `lib/updateProgramApply.ts`

```ts
import type { ProgramDiff } from "./updateProgramTypes.ts"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"
import { applyDayUpdate } from "./programPersistence.ts"

export interface AppliedDay {
  id: string                  // workout_days.id (filled post-INSERT for new days)
  label: string
  ops: Array<"meta_changed" | "exercises_replaced" | "inserted" | "deleted">
}

export interface ApplyResult {
  applied_days: AppliedDay[]
  failed_at: { day_label: string; error: string } | null
  remaining_days: Array<{ label: string; intent: "delete" | "update" | "insert" }>
  message: string
}

export async function applyProgramDiff(
  supabase: SupabaseClient,
  diff: ProgramDiff,
  catalogById: Map<string, CatalogExerciseForProgram>,
  userId: string,
): Promise<ApplyResult>
```

#### Orchestration logic

1. **Step 0 — Program rename** (if `diff.name_change !== null`):
   - `UPDATE programs SET name = ? WHERE id = ?`.
   - On error: return `{ applied_days: [], failed_at: { day_label: "<program rename>", error }, remaining_days: <all days from diff>, message: <partial-failure with retry guidance> }`.

2. **Step 1 — Build apply plan** based on `diff.apply_order`:
   - `"default"`: `[...deletes, ...updates, ...inserts]` (concat).
   - `"insert_first"`: `[...inserts, ...deletes, ...updates]` (concat).
   - Each entry tagged with `intent: "delete" | "update" | "insert"` for the `remaining_days` shape.

3. **Step 2 — Per-day loop**:
   - For each `op` in plan:
     - **delete**:
       - DELETE workout_exercises (defensive even with CASCADE).
       - DELETE workout_days WHERE id = op.id.
       - On success: push `{ id: op.id, label: op.label, ops: ["deleted"] }` to `applied_days`.
       - On error: return partial-success with `failed_at` and `remaining_days = <unprocessed ops>`.
     - **update**:
       - UPDATE workout_days SET label, emoji, sort_order WHERE id = op.id (only set fields that changed).
       - Call `applyDayUpdate(supabase, op.id, op.parsed_exercises, catalogById, userId)`.
       - Track ops: `["meta_changed", "exercises_replaced"]` if both changed, just one if only one.
       - On success: push to `applied_days`.
       - On error: return partial-success.
     - **insert**:
       - INSERT workout_days RETURNING id.
       - INSERT workout_exercises via `buildWorkoutExerciseInsertRowsForDay` directly (NOT via `applyDayUpdate` since there's nothing to delete).
       - On success: push `{ id: <new>, label: op.label, ops: ["inserted"] }`.
       - On error: return partial-success.

4. **Step 3 — Build message**:
   - **Full success**: `"Updated <total> day(s)."`
   - **Partial failure**: `"Updated <N> day(s). Failed at day '<failed_at.day_label>': <error>. <M> day(s) remaining. To retry, submit a new patch containing only the remaining_days (with their \`id\`s) plus any corrections; applied_days are already up to date and should be omitted from \`days[]\` (or included with their existing \`id\` to be left unchanged)."`

5. Return the `ApplyResult`.

### `lib/updateProgramApply.test.ts`

Vitest with an in-memory mock supabase (a `MockSupabase` class that implements just `from(table).select/insert/update/delete/...`).

Required test cases:

| Test | Input ProgramDiff | Mock supabase behavior | Asserted output |
|---|---|---|---|
| **rename only success** | name_change set, no day ops | rename UPDATE succeeds | `applied: []`, `failed_at: null`, `message: "Updated 0 day(s)."` (rename succeeded, no day ops counted) |
| **add one day success** | 1 insert | inserts succeed | `applied: [{ ops: ["inserted"] }]`, `failed_at: null` |
| **update one day success** | 1 update | UPDATE + applyDayUpdate succeed | `applied: [{ ops: ["meta_changed", "exercises_replaced"] }]` (or just one if no meta change in diff) |
| **delete one day success** | 1 delete | DELETEs succeed | `applied: [{ ops: ["deleted"] }]` |
| **mid-flight failure at day 2** | 4 ops total | first op succeeds, second op DELETE fails | `applied.length === 1`, `failed_at.day_label === <2nd label>`, `remaining_days.length === 2`, `message` contains the verbatim retry guidance string |
| **smart re-order: insert_first** | drain-to-0 + 1 insert (apply_order: "insert_first") | inserts run before deletes (verified by mock call order) | mock recorded INSERT before DELETE |
| **smart re-order: default** | partial drain (apply_order: "default") | deletes run before inserts | mock recorded DELETE before INSERT |
| **rename failure** | name_change set + 3 day ops | rename UPDATE fails | `applied: []`, `failed_at.day_label === "<program rename>"`, `remaining_days.length === 3` |

The mock supabase tracks call order so smart-reorder can be asserted. Suggest a simple `MockSupabase` helper in the test file or a test util:

```ts
class MockSupabase {
  private state: Map<string, Record<string, unknown>[]> = new Map()
  public callLog: Array<{ table: string; op: string; args: unknown }> = []
  // ... implement enough of the SupabaseClient surface for these tests
}
```

### `applyDayUpdate` standalone test

Add a few cases to the existing programPersistence test file (or new `applyDayUpdate.test.ts`):

- 1 happy path: existing day with 3 exercises, applyDayUpdate with 5 new exercises → DELETE called once, INSERT called with 5 rows.
- 1 catalog miss: parsedExercises references an id not in catalogById → throws / returns error.
- 1 DELETE error: mock supabase returns error on DELETE → `{ ok: false, error }` propagated.

## Out of Scope

- Diff computation (T78).
- Validation (T79).
- Handler wiring (T81).
- FK pre-check on `days_to_delete` (T81 handler — populates `session_count` on diff entries).
- Active cycle warning generation (T81 handler — passes string into the response).
- Format helpers (`formatProgramAfterUpdate`, `formatActiveCycleWarning` — T81).
- Web mirror in `src/lib/programPersistence.ts` — explicitly out per Tech Plan.

## Acceptance Criteria

- [ ] `lib/programPersistence.ts` exports `applyDayUpdate` with the documented signature.
- [ ] `lib/updateProgramApply.ts` exists, exports `applyProgramDiff` and `ApplyResult` / `AppliedDay` types.
- [ ] All test cases in the behavior table pass green.
- [ ] **Mid-flight failure test asserts the `message` field contains the exact retry guidance string** (verbatim match, not regex partial): *"To retry, submit a new patch containing only the remaining_days (with their `id`s) plus any corrections; applied_days are already up to date and should be omitted from `days[]` (or included with their existing `id` to be left unchanged)."*
- [ ] **Smart re-order test verifies call order** via the MockSupabase callLog: in `apply_order: "insert_first"` scenarios, the INSERT calls precede the DELETE calls.
- [ ] **Rename failure does NOT touch any day** — no DELETE/INSERT/UPDATE calls on workout_days or workout_exercises after the rename UPDATE failure (verified via callLog being empty post-rename).
- [ ] Demoable: a maintainer can construct any `ProgramDiff` and confirm the apply behavior in isolation, with no need to spin up real supabase.

## References

- Epic Brief: `file:docs/Epic_Brief_—_MCP_—_update_program_#280.md` (Stories 10, 19-21)
- Tech Plan: `file:docs/Tech_Plan_—_MCP_—_update_program_#280.md` ("Apply order" + "Atomicity" + "Partial-success report" Key Decisions; "lib/updateProgramApply.ts" component description; T5 in Implementation Sequence)
- Shared types: `file:supabase/functions/mcp/lib/updateProgramTypes.ts` (created in T77)
- Modified file: `file:supabase/functions/mcp/lib/programPersistence.ts`
- New files: `file:supabase/functions/mcp/lib/updateProgramApply.ts`, `file:supabase/functions/mcp/lib/updateProgramApply.test.ts`
