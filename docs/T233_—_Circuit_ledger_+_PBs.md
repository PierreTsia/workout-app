# T233 — Circuit ledger + Profil PBs

## Goal

Wire the Circuits block to the HITL fold: catalog only, type-aware **AMRAP** and **Tours**, per-row **run count** + **best run in the window** (not last), last-8 sparkline (≥2 runs for a line), **Profil Circuit PB** = career-best `template_fingerprint` **in this window**, not last-8 `annotateAmrapRuns.isPb`. First complete run is not a PB. Addresses Epic story 16. The T0 `Force` row is a fixture stand-in — do not persist a fake catalog seed.

## Mode

AFK — ledger vs `RUN_LIMIT 8` is locked.

## Slice

migration `get_profile_circuit_ledger` → hook → `lib/profile` career PB + window best + run count → Circuits block + sparkline → vitest (first run ≠ PB, jetable out, best ≠ last)

## Dependencies

T225 (shell) — **done**. **T237 passed 2026-08-21** — gate lifted. Window from `ProfileWindowContext`. **Ready now**, parallel with T227 (ledger is not the session snapshot). Do not mint a `Force` catalog seed.

## Scope

### RPC

`get_profile_circuit_ledger()`: all complete catalog `block_runs` for `auth.uid()` (fingerprint, started_at, score inputs). Not `RUN_LIMIT 8`. Jetable (`benchmark_circuit_id` null) excluded.

### Algos

- Career PB: best complete run of that fingerprint across the **full ledger**; a window run is a **Profil Circuit PB** if it equals that career best **and** there is a prior complete run to beat.
- PBs stat = count of such runs with `started_at` in the current window.
- Sparkline: last 8 chronological; ≥2 runs to draw. The line is not the score.
- Type-aware scoring: AMRAP via `file:src/lib/amrapScore.ts` (max rounds, then leftover); Tours via min completion time. Never hardcode `AmrapScore` on a Tours row.
- Row **score** = best complete run of that fingerprint **in the window**.
- Row **run count** = complete catalog runs of that fingerprint in the window.
- Olympians `{n}/4` pill if already available from achievements — not a fourth stat invented here.

### UI

Replace Circuits fixture adapter (`file:src/components/profile/CircuitLedgerRow.tsx`). Keep the HITL layout: name + small PB on the name, type below (`AMRAP N min` / `N tours`), run count, best score, sparkline. Jetable stay in History — do not list them. If the athlete has no catalog Tours, the list is AMRAP-only; the renderer must still accept both modes.

### Tests

- First complete Cindy is not a PB; second faster/higher is
- A PB outside last-8 still counts if the **window** contains that run
- Score column is the window best, not `runs.at(-1)`
- Jetable run absent from the ledger
- Sparkline hidden with a single run; best score + run count still shown

## Out of Scope

- History shelf last-8 behavior
- Achievement grant paths
- Mixing jetable Circuits into Mix (already T228)

## Acceptance Criteria

- [ ] Ledger RPC returns catalog runs without `RUN_LIMIT 8`
- [ ] First complete run is not a PB; a later career-best in-window is
- [ ] Sparkline requires ≥2 runs; score is window best; PB count uses full history
- [ ] Demoable: a Cindy PB older than 8 runs still increments PBs when the window includes that day
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief story 16
- Tech Plan: `get_profile_circuit_ledger`
- Glossary: **Profil Circuit PB**
