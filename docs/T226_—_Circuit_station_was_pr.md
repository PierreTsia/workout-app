# T226 — Circuit station `was_pr`

## Goal

Circuit station logs use the same `prDetection` as solos so a loaded deadlift in a Circuit can mint a **Profil PR**. Today `file:src/lib/blockSetLog.ts` writes `wasPr: false`. Addresses Epic story 12 (prerequisite of Records wiring).

## Mode

AFK — “same `prDetection`, not a second PR type” is locked.

## Slice

`blockSetLog` write path → `prDetection` → finish Circuit set → `set_logs.was_pr` → vitest + backfill script for existing rows

## Dependencies

None (parallel with T224 / T225). **Hard dep of T229.**

## Scope

### Write path

When logging a Circuit station set, compute `was_pr` via `file:src/lib/prDetection.ts` with the same inputs as solo sets (including duration PRs). Do not leave `wasPr: false` as a constant.

Keep Circuit **score PBs** (AMRAP / Tours) in the Circuits block — this ticket is catalog `exercise_id` PRs only.

### Backfill

Extend or add `scripts/backfill-was-pr.ts` (or the existing PR backfill if one already scans `set_logs`) so historical `block_exercise_id IS NOT NULL` rows get `was_pr` under the same rules. Type-check the script standalone (workspace rule: `tsconfig.app.json` does not cover `scripts/`).

### Tests

- Weighted Circuit station that beats prior solo/circuit scores → `was_pr: true`
- Duration Circuit station can PR
- Jetable vs catalog: detection is on `exercise_id`, not `benchmark_circuit_id`

## Out of Scope

- Records UI / combo chart (T229)
- Circuit ledger / **Profil Circuit PB** (T233)
- Changing `get_cycle_stats`

## Acceptance Criteria

- [ ] `blockSetLog` no longer hardcodes `wasPr: false`
- [ ] Vitest: a weighted Circuit station that beats prior scores sets `was_pr`
- [ ] Vitest: a duration Circuit PR is possible
- [ ] Backfill script exists and is documented to run (do not require a production run in this ticket)
- [ ] Demoable: finish a Circuit with a heavier deadlift station than last time → that `set_logs` row has `was_pr = true`
- [ ] `npx tsc -p tsconfig.app.json --noEmit` plus standalone `tsc` on the script; env-stripped vitest for the new tests

## References

- Epic Brief story 12, success measure 12
- Tech Plan: Circuit `was_pr` decision
- Glossary: **Profil PR** in `file:docs/CONTEXT.md`
