# T193 — GO snapshot catalog id

## Goal

Stamp `benchmark_circuit_id` on `block_runs` at GO (queue + DB), copied from the day’s **Exercise Block**. A later **Circuit Fork** that retargets the slot cannot rewrite Monday’s identity. Stories 11, 13.

## Mode

**AFK** — column and payload are specified in the Tech Plan.

## Slice

`ALTER block_runs` → `BlockRunPayload` + `useBlockRun.stampGo` → `processBlockRun` upsert → vitest queue/hydrate

## Dependencies

T191 (`exercise_blocks.benchmark_circuit_id`). History UI → **T194**.

## Scope

### Schema

- `block_runs.benchmark_circuit_id uuid NULL REFERENCES benchmark_circuits(id) ON DELETE SET NULL`.

### Queue / runner

- `file:src/lib/syncService.ts` `BlockRunPayload.benchmarkCircuitId: string | null` ; upsert maps to snake_case.
- `file:src/hooks/useBlockRun.ts` `stampGo` / `stampFinish`: `benchmarkCircuitId: block.benchmark_circuit_id ?? null`.
- Hydrate / tests: field round-trips queue → DB. Jetable GO still works (`null`).

## Out of Scope

- History aggregation → **T194** / **T195**.
- Fork retarget → **T196** (this ticket only *preserves* the snapshot so T196 cannot poison it).
- Tours `block_runs` (still AMRAP-only).

## Acceptance Criteria

- [ ] GO on a Cindy-linked block writes `block_runs.benchmark_circuit_id` = that catalog id.
- [ ] Jetable AMRAP GO writes `NULL`.
- [ ] Updating `exercise_blocks.benchmark_circuit_id` after GO does **not** change the existing `block_runs` row (test can simulate T196).
- [ ] Offline: queued `block_run` carries the id ; drain upserts it.
- [ ] `isRunComplete` / `runFingerprint` untouched.

## References

- Epic Brief stories 11, 13
- Tech Plan GO stamp, Failure Mode « Fork then first GO »
- `file:src/hooks/useBlockRun.ts`, `file:src/lib/syncService.ts`
