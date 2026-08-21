# T226 — Circuit station `was_pr`

**Status:** done on `feat/512/profil-first-class-dashboard`. Write path + vitest + backfill script. Production `--apply` is **not** this ticket — run it before T236.

## Goal

Circuit station logs use the same `prDetection` as solos so a loaded deadlift in a Circuit can mint a **Profil PR**. Addresses Epic story 12 (prerequisite of Records wiring).

## Mode

AFK — “same `prDetection`, not a second PR type” is locked.

## Slice

`blockSetLog` write path → `prDetection` → finish Circuit set → `set_logs.was_pr` → vitest + backfill script for existing rows

## Dependencies

None (was parallel with T224 / T225). **Hard dep of T229 — now satisfied.** Not a blocker for T227 / T233.

## Scope

### Write path

`file:src/lib/blockSetLog.ts` computes `was_pr` via `file:src/lib/prDetection.ts` with the same inputs as solo sets (including duration PRs). No hardcoded `wasPr: false`.

Keep Circuit **score PBs** (AMRAP / Tours) in the Circuits block — this ticket is catalog `exercise_id` PRs only.

### Backfill

`file:scripts/backfill-was-pr.ts` groups by `user_id::exercise_id` across **all** finished `set_logs`, including `block_exercise_id IS NOT NULL`. Documented dry-run / `--apply`. Ticket does not require a production run.

### Tests

- Weighted Circuit station that beats prior solo/circuit scores → `was_pr: true`
- Duration Circuit station can PR
- Jetable vs catalog: detection is on `exercise_id`, not `benchmark_circuit_id`

## Out of Scope

- Records UI / combo chart (T229)
- Circuit ledger / **Profil Circuit PB** (T233)
- Changing `get_cycle_stats`
- Production backfill apply (T236 prerequisite)

## Acceptance Criteria

- [x] `blockSetLog` no longer hardcodes `wasPr: false`
- [x] Vitest: a weighted Circuit station that beats prior scores sets `was_pr`
- [x] Vitest: a duration Circuit PR is possible
- [x] Backfill script exists and is documented to run (do not require a production run in this ticket)
- [x] Demoable: finish a Circuit with a heavier deadlift station than last time → that `set_logs` row has `was_pr = true`
- [x] `npx tsc -p tsconfig.app.json --noEmit` plus standalone `tsc` on the script; env-stripped vitest for the new tests

## References

- Epic Brief story 12, success measure 12
- Tech Plan: Circuit `was_pr` decision
- Glossary: **Profil PR** in `file:docs/CONTEXT.md`
