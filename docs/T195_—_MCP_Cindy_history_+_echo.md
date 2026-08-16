# T195 — MCP Cindy history + echo

## Goal

Agents see the same Cindy identity as the PWA: `get_workout_history` groups by `block_runs.benchmark_circuit_id` when set, else `block_id`. Details / dry_run echo `benchmark_slug` when the Circuit is linked. Story 21.

## Mode

**AFK** — lockstep with T194 grouping key. HITL agent readback → **T198**.

## Slice

`getWorkoutHistory` + `sessionHistoryGrouping` (Edge) → `format.ts` echo slug → Deno tests

## Dependencies

T191 (echo on details already started — finish if needed), T193 (GO snapshot on runs).

## Scope

### History

- `file:supabase/functions/mcp/tools/getWorkoutHistory.ts` + `file:supabase/functions/mcp/lib/sessionHistoryGrouping.ts` : grouping key = catalog id when `block_runs.benchmark_circuit_id` is set, else `block_id`. PB/delta via existing Edge `amrapScore` / annotate, scoped to that key.
- Do **not** invent a second score format. Glossed `27+3` stays.

### Echo

- dry_run / `get_program_details` / day read: `benchmark_slug` (and/or id) when `exercise_blocks.benchmark_circuit_id` resolves to a seed. Forks have `slug` NULL — echo id or omit slug, don’t invent a handle.

## Out of Scope

- PWA sheet → **T194**.
- CCT line for Tours on MCP (still deferred ADR 0011).
- Skill prose → **T197**.

## Acceptance Criteria

- [ ] Two finished Cindy runs on different days → history shows one catalog identity, shared PB.
- [ ] Jetable AMRAP history still groups by `block_id`.
- [ ] dry_run / details of a cindy-instantiated day echo `benchmark_slug: "cindy"`.
- [ ] Unknown/generic Circuit: no slug field (or null), no coerce on read.
- [ ] Deno tests for grouping + echo ; Zeus/Tours fixtures non-regression.

## References

- Epic Brief story 21
- Tech Plan MCP `get_workout_history` lockstep
- `file:supabase/functions/mcp/lib/amrapScore.ts`, `file:supabase/functions/mcp/lib/format.ts`
