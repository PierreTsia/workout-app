# T76 — get_program_details Exposes exercise_id

## Goal

Replace the workout_exercise slot id with the catalog `exercise_id` in `get_program_details`'s markdown output, so an MCP-connected agent can construct an `update_program` patch that references catalog exercises (for swap or preservation) without going through `search_exercises` for every name. This unblocks Story 7 and is a hard prerequisite for Story 22 (the SKILL.md worked examples need a stable `exercise_id` to demo).

Cites Epic Brief stories: **#7, #22 (partial)**.

## Mode

**AFK.** Single-line patches in 2 files + type extension + test assertion update + a one-line repo grep verification. No design judgement required.

## Slice

`tools/getProgramDetails.ts` → `lib/format.ts` → `vitest` → `rg` repo grep verification.

This ticket ships an immediately demoable behavior: any MCP client calling `get_program_details` after T76 sees `*(exercise_id: ...)*` instead of `*(id: ...)*` in the markdown — independently of the rest of Epic C.

## Dependencies

**None.** Can ship in standalone PR before any other Epic C ticket.

## Scope

### File-level changes

| File | Change |
|---|---|
| `supabase/functions/mcp/tools/getProgramDetails.ts` | (1) Line 69: extend the inner `select` projection to include `exercise_id`. New string: `"id, name, archived_at, workout_days(id, label, emoji, sort_order, workout_exercises(id, exercise_id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order))"`. (2) Lines 20-29: extend `WorkoutExerciseRow` interface with `exercise_id: string`. (3) Line 95-99 mapping: forward `exercise_id` through to the format helper. |
| `supabase/functions/mcp/lib/format.ts` | (1) Line ~239 (`ProgramDetailsExercise` interface): add `exercise_id: string`. (2) Line 268: change the rendered string from `*(id: ${ex.id})*` to `*(exercise_id: ${ex.exercise_id})*`. The slot `id` field stays in the type for any future reader but is no longer in markdown. |
| `supabase/functions/mcp/lib/format_test.ts` (and any vitest equivalent) | Update assertion strings: any test that checks for `*(id: <slot-uuid>)*` in `formatProgramDetails` output must now check `*(exercise_id: <catalog-uuid>)*`. |

### Repo grep verification (PR description requirement)

Before merge, run and paste the output in the PR description:

```bash
rg "workout_exercises.*\(id:" --type=ts
rg "ex\.id" supabase/functions/mcp/lib/format.ts
```

Expected output: zero downstream consumer of the slot id rendered in `formatProgramDetails`. If any consumer is found, **stop and add it to the PR conversation** — the design changes (we'd need to expose both `slot_id` and `exercise_id`).

### Markdown output before/after

**Before** (current):
```
### 💪 Push *(id: a1b2-...)*
  - **Bench Press** *(id: c3d4-...)*: 4 × 8 reps @ 80 kg (rest 90s)
```

**After**:
```
### 💪 Push *(id: a1b2-...)*
  - **Bench Press** *(exercise_id: e5f6-...)*: 4 × 8 reps @ 80 kg (rest 90s)
```

(The day `id` is `workout_days.id` and remains unchanged — required for `update_program`'s day identity. Only the per-exercise line changes.)

## Out of Scope

- Adding `update_program` itself (T81).
- Showing both `slot_id` and `exercise_id` (only triggered if grep finds a consumer of the old slot id — escalate then).
- Touching `get_upcoming_workouts` or any other tool that surfaces program structure.
- Renaming the `id` field in the `WorkoutExerciseRow` type (kept for defensive completeness).

## Acceptance Criteria

- [ ] `tools/getProgramDetails.ts` `select` includes `exercise_id` in the inner `workout_exercises(...)` projection.
- [ ] `WorkoutExerciseRow` and `ProgramDetailsExercise` types both carry `exercise_id: string`.
- [ ] `formatProgramDetails` markdown output renders `*(exercise_id: <uuid>)*` (NOT `*(id: <uuid>)*`) for every exercise line — verified by an updated unit test.
- [ ] All existing format / get_program_details tests pass green after the assertion update.
- [ ] PR description includes the output of `rg "workout_exercises.*\(id:" --type=ts` showing zero consumer of the old slot id pattern (or, if a consumer is found, an explicit follow-up plan in the PR conversation).
- [ ] Demoable end-to-end: a manual MCP call `get_program_details(program_id)` against any non-empty program returns markdown containing at least one `*(exercise_id: ...)*` token.

## References

- Epic Brief: `file:docs/Epic_Brief_—_MCP_—_update_program_#280.md` (Story 7, 22)
- Tech Plan: `file:docs/Tech_Plan_—_MCP_—_update_program_#280.md` ("`get_program_details` change" Key Decision; T1 in Implementation Sequence)
- Modified files: `file:supabase/functions/mcp/tools/getProgramDetails.ts`, `file:supabase/functions/mcp/lib/format.ts`
