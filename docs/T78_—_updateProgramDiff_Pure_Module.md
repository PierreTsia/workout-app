# T78 — updateProgramDiff Pure Module

## Goal

Implement the central pure function of Epic C: `computeProgramDiff(currentProgram, parsedPatch) → ProgramDiff`. This is the brain — it decides what changed (rename, days inserted/updated/deleted/unchanged) and computes the smart-reorder flag (`apply_order: "default" | "insert_first"`). Side-effect-free, supabase-free, fully testable through fixtures. T81's handler will consume this diff to render dry_run output AND to drive the apply orchestrator.

Cites Epic Brief stories: **#2 (omit days = unchanged), #3 (add day), #4 (reorder via array position), #5 (omit existing day = delete), #6 (rename day), #8 (union exercise shape passes through), #10 (wipe-and-reinsert per touched day)**.

## Mode

**AFK.** Pure function. All test cases mechanically verifiable via JSON fixtures. No design judgement required mid-flight.

## Slice

`lib/updateProgramDiff.ts` (new) → `lib/updateProgram_fixtures.json` (new, JSON test data) → `lib/updateProgramDiff.test.ts` (new vitest, table-driven from fixture).

Not demoable end-to-end as a user-facing change — this is a pure module. Demoable as: "given any input pair in the fixture, the diff matches the expected output exactly." The full demoability lands in T81.

## Dependencies

**Soft dep on T77** (for the shared types in `lib/updateProgramTypes.ts`). If T78 starts before T77 lands, the developer can locally inline the type definitions and replace with the import once T77 merges. **Recommended: wait for T77 to merge before opening T78 PR**.

## Scope

### `lib/updateProgramDiff.ts`

```ts
import type {
  CurrentProgramSnapshot,
  ParsedPatch,
  ProgramDiff,
} from "./updateProgramTypes.ts"

/**
 * Pure structural diff between the current program state and a parsed patch.
 * Decides which days are inserted, updated, deleted, or unchanged, and sets
 * the apply_order flag for the smart-reorder escape hatch.
 *
 * Pre-condition: parsedPatch.days has already passed validateDayIdentities
 * (i.e. all provided ids exist in current.days; no duplicate ids).
 */
export function computeProgramDiff(
  current: CurrentProgramSnapshot,
  patch: ParsedPatch,
): ProgramDiff
```

### Behavior specification

| Input scenario | `name_change` | `days_to_insert` | `days_to_update` | `days_to_delete` | `days_unchanged` | `apply_order` |
|---|---|---|---|---|---|---|
| `name` provided + different from current.name; `days` undefined | `{from, to}` | [] | [] | [] | all current.days | `"default"` |
| `name` provided = current.name; `days` undefined | null | [] | [] | [] | all current.days | `"default"` |
| `name` undefined; `days` undefined | null | [] | [] | [] | all current.days | `"default"` |
| `days` provided, all entries have matching `id` | name change as above | [] | all patch.days | [] | [] | `"default"` |
| `days` provided, all entries are new (no `id`) | name change as above | all patch.days (sort_order = position) | [] | all current.days (with session_count = 0 placeholder) | [] | computed (see below) |
| `days` provided mixed (some `id`, some not, some current.days omitted) | name change as above | patch entries without `id` | patch entries with `id` | current.days not referenced in patch | [] | computed |

`apply_order = "insert_first"` when:
- `current.days.length - days_to_delete.length === 0` (i.e. all current days are being deleted), AND
- `days_to_insert.length > 0`

Otherwise `"default"`.

### Resolved fields per day

For `days_to_update[i]`:
- `id`: from patch
- `current`: snapshot of the matching current day's `{label, emoji, sort_order}`
- `label`: from patch (always provided per shape rule)
- `emoji`: from patch IF provided, ELSE from `current.emoji`
- `sort_order`: position-in-patch
- `parsed_exercises`: from patch (already validated by upstream `validateDayExercises`)

For `days_to_insert[i]`:
- `label`, `emoji`, `parsed_exercises`: from patch
- `sort_order`: position-in-patch
- (no `current`)

For `days_to_delete[i]`:
- `id`, `label`: from current
- `session_count`: 0 (placeholder — populated by handler post-FK-precheck)
- `blocking`: false (placeholder)

### `lib/updateProgram_fixtures.json`

Array of test scenarios. Each scenario is a top-level object:

```json
{
  "name": "human-readable scenario name",
  "current": { ... CurrentProgramSnapshot ... },
  "patch": { ... ParsedPatch ... },
  "expected": { ... ProgramDiff ... }
}
```

Required fixture scenarios (≥10):

1. **rename only** — name change, days undefined → `name_change` set, all `days_to_*` empty, `days_unchanged` populated.
2. **noop name** — name same as current, days undefined → `name_change` null.
3. **add one day** — patch has all current days (with ids) + 1 new (no id) → `days_to_insert.length === 1`, `days_to_update.length === current.length`, `days_to_delete.length === 0`.
4. **remove one day** — patch omits 1 current day → `days_to_delete.length === 1`, others updated.
5. **rename day** — patch has matching id but different label → `days_to_update[0].current.label !== days_to_update[0].label`.
6. **swap exercise** — patch's day has same id but parsed_exercises differs → `days_to_update[0].parsed_exercises` reflects the new list.
7. **reorder days** — patch reverses the order of current days (with ids) → `days_to_update` entries have new `sort_order` reflecting array position.
8. **mixed (add + remove + update)** — combination of 3, 4, 5 in one patch.
9. **drain-to-0 + refill** — patch contains only new days (no `id`); ALL current.days will be deleted and new ones inserted → `apply_order === "insert_first"`.
10. **emoji preserved when not in patch** — patch updates a day with same id, no `emoji` field → `days_to_update[0].emoji === current.emoji`.
11. **no apply_order swap when partial drain** — patch removes 2 of 3 days but adds 0 → `apply_order === "default"` (escape hatch only triggers when 0-days transit + new inserts).

### `lib/updateProgramDiff.test.ts`

Table-driven vitest:

```ts
import fixtures from "./updateProgram_fixtures.json"
import { computeProgramDiff } from "./updateProgramDiff"

describe("computeProgramDiff", () => {
  for (const scenario of fixtures) {
    it(scenario.name, () => {
      const result = computeProgramDiff(scenario.current, scenario.patch)
      expect(result).toEqual(scenario.expected)
    })
  }
})
```

Plus 1-2 additional tests outside the fixture for very specific things hard to express as static JSON (e.g. asserting that the function does NOT mutate its inputs).

## Out of Scope

- Validation of `parsedPatch` shape — assumed pre-validated by T79 upstream. The diff trusts its inputs.
- Validation of day identity (no duplicate ids, ids exist in current) — assumed pre-validated by T79.
- FK pre-check on `days_to_delete` — done by T81 handler. Diff sets `session_count = 0` placeholder.
- Active cycle detection — done by T81 handler.
- Any supabase calls.
- Rendering markdown — done by T81 (`formatProgramAfterUpdate`).
- Apply orchestration — done by T80.

## Acceptance Criteria

- [ ] `lib/updateProgramDiff.ts` exists, exports `computeProgramDiff` with the documented signature.
- [ ] `lib/updateProgram_fixtures.json` exists with ≥10 scenarios covering all rows of the behavior matrix above.
- [ ] `lib/updateProgramDiff.test.ts` runs table-driven tests over every fixture entry and all pass.
- [ ] The "drain-to-0 + refill" fixture asserts `apply_order === "insert_first"`.
- [ ] The "no apply_order swap when partial drain" fixture asserts `apply_order === "default"`.
- [ ] Test asserting that `computeProgramDiff` does NOT mutate the input `current` or `patch` objects.
- [ ] `npm test -- updateProgramDiff` runs green in isolation.
- [ ] Demoable: any maintainer can add a new entry to `updateProgram_fixtures.json` and verify the diff function handles it just by re-running the test — proving the module is genuinely pure and fixture-driven.

## References

- Epic Brief: `file:docs/Epic_Brief_—_MCP_—_update_program_#280.md` (Stories 2-6, 8, 10)
- Tech Plan: `file:docs/Tech_Plan_—_MCP_—_update_program_#280.md` ("Diff module" Key Decision; "lib/updateProgramDiff.ts (the brain)" component description; T3 in Implementation Sequence)
- Shared types: `file:supabase/functions/mcp/lib/updateProgramTypes.ts` (created in T77)
- New files: `file:supabase/functions/mcp/lib/updateProgramDiff.ts`, `file:supabase/functions/mcp/lib/updateProgram_fixtures.json`, `file:supabase/functions/mcp/lib/updateProgramDiff.test.ts`
