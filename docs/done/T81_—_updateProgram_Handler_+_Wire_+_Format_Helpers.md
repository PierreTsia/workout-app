# T81 — updateProgram Handler + Wire + Format Helpers

## Goal

Wire all the modules together: the new MCP tool `update_program` becomes callable end-to-end. The handler orchestrates auth → fetch current program (RLS-protected) → parse patch shape → validate day identities → catalog fetch → validate per-day exercises → compute diff → FK pre-check → active cycle check → destructive-guard → render dry_run output OR call apply orchestrator. Adds the two format helpers (`formatProgramAfterUpdate`, `formatActiveCycleWarning`) used only here. Bumps `SERVER_INFO.version` and registers the 9th tool. This is the first ticket where every Epic Brief story becomes observable.

Cites Epic Brief stories: **#1 (single-call rename), #11 (dry_run defaults), #12 (full result in preview), #13 (auxiliary diff sections), #16 (FK pre-check structured error), #19, #20 (mid-cycle warning), #21 (partial-success report passed through)** — and **all** stories become demoable here for the first time.

## Mode

**AFK.** Every behavior is captured by integration tests against a fake supabase. No design judgement remains — all decisions tabled in Tech Plan and locked through T78-T80.

## Slice

`tools/updateProgram.ts` (new handler) → `tools/registry.ts` (insert) → `index.ts` (version bump) → `lib/format.ts` (extension: 2 new helpers) → `tools/updateProgram_test.ts` (new Deno integration test).

**This is the demoable end-to-end ticket of Epic C** — once T81 lands, an MCP client can call `update_program` and observe every documented behavior.

## Dependencies

**Hard deps**: T77 (catalog helper, validateDayExercises, shared types), T78 (computeProgramDiff), T79 (parsePatchShape, validateDayIdentities, requireConfirmForDestructive), T80 (applyProgramDiff).

**Soft dep**: T76 — both T76 and T81 touch `lib/format.ts`. If T76 is not yet merged, the developer rebases at the end. If T76 was already merged, no conflict.

## Scope

### File-level changes

| File | Change |
|---|---|
| `supabase/functions/mcp/tools/updateProgram.ts` | **New file.** ~250 LOC. ToolDefinition with input schema + handler. |
| `supabase/functions/mcp/tools/registry.ts` | Import `updateProgram`, append after `createProgram` in the `tools` array (becomes 9-element). |
| `supabase/functions/mcp/index.ts` | Bump `SERVER_INFO.version`: `"0.3.x"` → `"0.4.0"`. |
| `supabase/functions/mcp/lib/format.ts` | **Add** `formatProgramAfterUpdate(diff, currentProgram, catalogById): string` and `formatActiveCycleWarning(cycle: { started_at: string }): string`. |
| `supabase/functions/mcp/tools/updateProgram_test.ts` | **New Deno integration test** covering 6+ scenarios with mock supabase. |

### Handler shape

```ts
import type { ToolDefinition } from "./registry.ts"
import { isUuid } from "../lib/uuid.ts"
import { fetchExercisesByIds } from "../lib/catalogLookup.ts"
import { validateDayExercises } from "../lib/createProgramValidation.ts"
import {
  parsePatchShape,
  validateDayIdentities,
  requireConfirmForDestructive,
} from "../lib/updateProgramValidation.ts"
import { computeProgramDiff } from "../lib/updateProgramDiff.ts"
import { applyProgramDiff } from "../lib/updateProgramApply.ts"
import { formatProgramAfterUpdate, formatActiveCycleWarning } from "../lib/format.ts"

export const updateProgram: ToolDefinition = {
  name: "update_program",
  description: "...",  // see below
  inputSchema: { ... },  // see below
  async handler(args, supabase) { ... },  // see below
}
```

### Handler orchestration (in this exact order)

1. **Auth guard**: bail with *"Authentication required — please provide a valid Bearer token."* if `supabase` is null.
2. **Fetch user_id**: `await supabase.auth.getUser()`. Required for `workout_days.user_id` on INSERTs.
3. **Parse patch shape**: `parsePatchShape(args)`. Bail on `{ ok: false, error }` → return `{ content: [{ text: error }], isError: true }`.
4. **Fetch current program** (single PostgREST call):
   ```ts
   const { data, error } = await supabase
     .from("programs")
     .select("id, name, workout_days(id, label, emoji, sort_order, workout_exercises(exercise_id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order))")
     .eq("id", parsedPatch.program_id)
     .maybeSingle()
   ```
   - On error: bail with the error message.
   - If `data === null`: bail with *"Program not found or you don't have access."* (RLS-filtered).
   - Build `CurrentProgramSnapshot` from data.
5. **Validate day identities**: `validateDayIdentities(parsedPatch.days, currentDayIds)`. Bail on error.
6. **Catalog fetch (batched)**: collect every `exercise_id` referenced across all days in the patch (string or object form). Single call to `fetchExercisesByIds(supabase, ids)`. Build `catalogById: Map<string, CatalogExerciseForProgram>`.
7. **Validate per-day exercises**: for each day in `parsedPatch.days`, call `validateDayExercises(day.rawExercises, day.label, catalogById)`. Bail on first error. On success, populate `day.parsed_exercises`.
8. **Compute diff**: `computeProgramDiff(currentProgram, parsedPatch)`.
9. **FK pre-check (batched)**: if `diff.days_to_delete.length > 0`:
   ```ts
   const { data, error } = await supabase
     .from("sessions")
     .select("workout_day_id, count")
     .in("workout_day_id", diff.days_to_delete.map(d => d.id))
     // PostgREST aggregate: use .group("workout_day_id") if supported, else fetch and reduce
   ```
   Annotate `diff.days_to_delete[i].session_count` and `blocking = (count > 0)`.
10. **Active cycle check** (always run):
    ```ts
    const { data: cycleData } = await supabase
      .from("cycles")
      .select("started_at")
      .eq("program_id", parsedPatch.program_id)
      .is("finished_at", null)
      .maybeSingle()
    ```
    If `cycleData`, build `warning: string` via `formatActiveCycleWarning(cycleData)`.
11. **Build dry_run errors**: collect entries from `diff.days_to_delete` where `blocking === true` into `errors[]`. Each entry: `{ day_label: <label>, error: "Cannot remove day '<label>' — it has <N> logged sessions. Rename or repurpose it instead." }`.
12. **Branch on `dry_run`**:
    - **dry_run=true** (default):
      - Render `rendered: string` via `formatProgramAfterUpdate(diff, currentProgram, catalogById)`.
      - Build `removed_days[]` from `diff.days_to_delete` with `session_count` and `blocking`.
      - Build `added_days[]` from `diff.days_to_insert` with `label` only.
      - Build `warnings: string[]` (the active cycle warning if any).
      - Build response payload (the `UpdateProgramDryRunOutput` shape from Tech Plan).
      - If `errors.length > 0` → `isError: true`, else success.
      - Return as `JSON.stringify(payload, null, 2)` in `content[0].text`.
    - **dry_run=false**:
      - Destructive-guard: `requireConfirmForDestructive(diff, parsedPatch.confirm)`. Bail on error.
      - Blocking errors: if `errors.length > 0` → bail with structured FK error message (concat).
      - Call `applyProgramDiff(supabase, diff, catalogById, user.id)`.
      - Build response payload (the `UpdateProgramApplyOutput` shape) including `warnings: [activeCycleWarning]` if any.
      - If `applyResult.failed_at !== null` → `isError: true` (partial failure), else success.
      - Return as `JSON.stringify(payload, null, 2)`.

### `inputSchema` (JSON Schema for MCP `tools/list`)

```json
{
  "type": "object",
  "required": ["program_id"],
  "properties": {
    "program_id": {
      "type": "string",
      "description": "UUID of the program to update. Obtain from list_programs or get_program_details."
    },
    "name": {
      "type": "string",
      "description": "Optional. New program name. Omit to leave the name unchanged."
    },
    "days": {
      "type": "array",
      "description": "Optional. Full desired list of days (declarative PUT-style inside this field). Days with `id` matching an existing day = UPDATE. Days without `id` = INSERT. Existing days NOT in this array = DELETE (requires `confirm: true` and FK pre-check). Omit the field entirely to leave days unchanged.",
      "minItems": 1,
      "maxItems": 14,
      "items": {
        "type": "object",
        "required": ["label", "exercises"],
        "properties": {
          "id": { "type": "string", "description": "UUID of an existing day to UPDATE. Omit to INSERT." },
          "label": { "type": "string" },
          "emoji": { "type": "string" },
          "exercises": {
            "type": "array",
            "minItems": 1,
            "maxItems": 40,
            "items": {
              "oneOf": [
                { "type": "string", "description": "Bare UUID = legacy defaults (3×10 @ 0kg, 90s rest)." },
                {
                  "type": "object",
                  "required": ["exercise_id", "sets", "reps", "weight_kg", "rest_seconds"],
                  "properties": {
                    "exercise_id": { "type": "string" },
                    "sets": { "type": "integer", "minimum": 1, "maximum": 10 },
                    "reps": { "type": "string", "description": "/^\\d+$/ or /^\\d+-\\d+$/, 1-50" },
                    "weight_kg": { "type": "number", "minimum": 0, "maximum": 500 },
                    "rest_seconds": { "type": "integer", "minimum": 0, "maximum": 600 },
                    "target_duration_seconds": { "type": "integer", "minimum": 5, "maximum": 600 }
                  }
                }
              ]
            }
          }
        }
      }
    },
    "dry_run": { "type": "boolean", "description": "Default true. Set false to apply." },
    "confirm": { "type": "boolean", "description": "Default false. REQUIRED when patch removes ≥1 day." }
  }
}
```

### Tool description (string, in `description` field)

Concise, agent-friendly. Includes:
- One-line purpose.
- The patch shape (PATCH top-level / declarative inside `days`).
- The atomicity disclaimer ("per-day, no cross-day rollback — partial-success report on failure").
- Pointer to dry_run default + confirm requirement on destructive patches.
- Pointer to mid-cycle warning behavior.
- Pointer to `set_active_program` (coming soon) for `is_active`.

Target ~30-40 lines so it fits `tools/list` reasonably.

### Format helpers in `lib/format.ts`

```ts
export function formatProgramAfterUpdate(
  diff: ProgramDiff,
  currentProgram: CurrentProgramSnapshot,
  catalogById: Map<string, CatalogExerciseForProgram>,
): string {
  // Renders the human-readable markdown of the program AS IT WILL BE after apply.
  // Uses formatPrescriptionLine + formatWeightConvention per exercise.
  // Headers: program name (resolved post-rename), each day with label + emoji.
  // For each day: render its parsed_exercises (or, for days_unchanged, its current workout_exercises).
}

export function formatActiveCycleWarning(cycle: { started_at: string }): string {
  // Returns: "Cycle actif depuis YYYY-MM-DD — cette modification affecte vos workouts restants dans ce cycle."
  // Date is YYYY-MM-DD, derived from started_at ISO string.
}
```

### `tools/updateProgram_test.ts` (Deno integration test)

Required scenarios with a fake supabase (in-memory state, RLS simulated by user_id filter):

| Scenario | Input | Asserted output |
|---|---|---|
| **rename success** | `{ program_id, name: "PPL v2", dry_run: false }` | response is JSON with `applied_days: []`, `failed_at: null`, programs table state has new name |
| **add day success** | `{ program_id, days: [...current with ids, ...new without id], dry_run: false }` | response includes new day with id, applied_days has 1 inserted |
| **remove day blocked** | `{ program_id, days: [<one current day omitted>], dry_run: false, confirm: true }` (omitted day has sessions in fake state) | response `isError: true`, message contains *"has N logged sessions"*, no DB writes |
| **destructive without confirm** | `{ program_id, days: [<one omitted>], dry_run: false }` (no confirm) | response `isError: true`, error contains *"Pass `confirm: true`"*, no DB writes |
| **dry_run default zero writes** | `{ program_id, days: [...] }` (no dry_run flag) | mock supabase recorded zero INSERT/UPDATE/DELETE on workout_* tables, response is dry_run JSON with full program preview + removed_days/added_days populated |
| **mid-cycle warning** | `{ program_id, name: "X", dry_run: false }` (fake state has unfinished cycle) | response.warnings contains the French warning string; same warning visible if dry_run defaults |
| **partial success simulated** | full patch with 4 days, fake supabase fails on 2nd day's INSERT | response includes `applied_days: 1 entry`, `failed_at.day_label = <2nd day label>`, `remaining_days: 2 entries`, `message` contains the verbatim retry guidance |
| **cross-user blocked** | `{ program_id: <other user's program> }` | response: *"Program not found or you don't have access."*, no DB writes (RLS-simulated by mock) |

### Description of integration test mock supabase

Shared with T80's mock or a copy. Implements:
- `from(table).select(...)` with filtering + nested embeds for the program SELECT.
- `from(table).insert(...).select()` returning the inserted row(s) with generated id.
- `from(table).update(...).eq(...)`.
- `from(table).delete().eq(...)` and `.in(...)`.
- `from(table).maybeSingle()`.
- `auth.getUser()` returning a fixed `{ user: { id: "user-1" } }`.
- A `callLog` for asserting call order.
- Optional fault injection: `supabase.failOn({ table: "workout_exercises", op: "insert", afterCalls: 2 })`.

Suggest extracting into `supabase/functions/mcp/test/mockSupabase.ts` if T80 hasn't already done so.

## Out of Scope

- SKILL.md updates (T82).
- Manual E2E with Iris (T82).
- Any change to `create_program` (covered by T77's refactor).
- New web-side functionality.
- Implementing optional `is_active` field (rejected by T79's `parsePatchShape`; pointer-only message).
- Multi-tool batch patches.

## Acceptance Criteria

- [ ] `tools/updateProgram.ts` exists with full handler implementation.
- [ ] `tools/registry.ts` imports `updateProgram` and includes it in the `tools` array immediately after `createProgram` (verified: `tools/list` returns 9 tools, `update_program` is the 7th).
- [ ] `SERVER_INFO.version` in `index.ts` is `"0.4.0"`.
- [ ] `lib/format.ts` exports `formatProgramAfterUpdate` and `formatActiveCycleWarning` with the documented signatures.
- [ ] All 8 integration test scenarios in the table pass green via `deno test supabase/functions/mcp/tools/updateProgram_test.ts`.
- [ ] **Cross-user RLS test** asserts the response is *"Program not found or you don't have access."* (NOT a generic supabase error) when `program_id` belongs to another user.
- [ ] **Mid-cycle warning test** asserts the warning string is present in BOTH the dry_run response (when no apply happens) AND the apply response.
- [ ] **Partial success test** asserts the `message` field contains the verbatim retry guidance string (same one verified in T80).
- [ ] **Demoable end-to-end via MCP**: starting from a non-empty program, calling `update_program` with `{ program_id, name: "X" }` (no other fields) renames the program and returns success — verified via the Deno integration test.

## References

- Epic Brief: `file:docs/Epic_Brief_—_MCP_—_update_program_#280.md` (Stories 1, 11-13, 16, 19-21; all stories become demoable)
- Tech Plan: `file:docs/Tech_Plan_—_MCP_—_update_program_#280.md` ("tools/updateProgram.ts" component description; T6 in Implementation Sequence)
- Shared types: `file:supabase/functions/mcp/lib/updateProgramTypes.ts` (T77)
- Imports from upstream tickets: T77 (`fetchExercisesByIds`, `validateDayExercises`), T78 (`computeProgramDiff`), T79 (validators), T80 (`applyProgramDiff`)
- Modified files: `file:supabase/functions/mcp/tools/registry.ts`, `file:supabase/functions/mcp/index.ts`, `file:supabase/functions/mcp/lib/format.ts`
- New files: `file:supabase/functions/mcp/tools/updateProgram.ts`, `file:supabase/functions/mcp/tools/updateProgram_test.ts`
