# T275 — In-place reconciliation of the Unified Day Sequence

## Goal

Replace the wipe + reinsert in `applyDayUpdate` with in-place reconciliation so
that a targeted prescription change preserves `workout_exercises.id` (and
therefore `set_logs.workout_exercise_id` / **Last Performance**) and a matched
Circuit preserves `exercise_blocks.id` (and `block_exercises.id`). Addresses
Epic Brief stories 1, 2, 3, 4, 7, 8.

## Dependencies

None.

## Scope

### Pure matching module

New `file:supabase/functions/mcp/lib/slotReconciliation.ts`:

- `reconcileSolos(existing, items)` — greedy match by `exercise_id`, order of
  appearance. Returns `{ matched, inserted, deleted }`; `sortOrder` is the
  incoming array index (shared namespace with Circuits).
- `reconcileBlocks(existing, items)` — pass 1 by `benchmark_circuit_id`, pass 2
  by order. Same return shape.
- `detachedSoloExerciseIds(existingExerciseIds, items)` — the deleted
  `exercise_id`s (used by T276).

### Apply path

`file:supabase/functions/mcp/lib/applyDayUpdate.ts`:

1. Pre-flight catalog check (unchanged).
2. Fetch existing solos (`id, exercise_id, sort_order`) and blocks
   (`id, benchmark_circuit_id, sort_order`) for the day.
3. Plan with the pure module.
4. Execute: `UPDATE` matched in place (id preserved), `INSERT` unmatched,
   `DELETE` leftover. Blocks reconcile their `block_exercises` in place too.
5. Delete the now-dead `wipeDaySequence` from `daySequence.ts`.

### Tests

- `slotReconciliation.test.ts` — matching rules (match / insert / delete,
  duplicate `exercise_id`, benchmark identity, order fallback).
- Rewrite `applyDayUpdate.test.ts` for the reconciliation call sequence.
- Deno `updateProgram_test.ts` — extend the mock to model `set_logs` FK
  detachment and add the regression test: a weight change keeps the slot id and
  `set_logs.workout_exercise_id`; a swap mints a new id and nulls the FK.

## Out of Scope

- The `dry_run` detachment warning (T276).
- ADR / glossary (T277).
- Any schema change.

## Acceptance Criteria

- [ ] A targeted weight change on a slot with prior progression issues an
      `UPDATE` on the existing `workout_exercises.id` — zero `DELETE` for that
      slot, zero `INSERT`.
- [ ] A movement swap mints a new slot id (the old slot is deleted).
- [ ] A matched Circuit keeps its `exercise_blocks.id`; a removed Circuit is
      deleted.
- [ ] Editing one exercise leaves the other slots / Circuits of the day
      untouched.
- [ ] `npm test`, `npm run lint`, `npx tsc -b` pass; Deno `*_test.ts` pass.

## References

- Epic Brief `file:docs/Epic_Brief_—_MCP_update_program_slot_identity_#666.md`
- Tech Plan `file:docs/Tech_Plan_—_MCP_update_program_slot_identity_#666.md`
- ADR 0012, ADR 0006
