# T233 — Circuit ledger + Profil PBs

## Goal

Wire the Circuits block: catalog only, type-aware AMRAP, last-8 sparkline (≥2 runs for a line), **Profil Circuit PB** = career-best `template_fingerprint` **in this window**, not last-8 `annotateAmrapRuns.isPb`. First complete run is not a PB. Addresses Epic story 16.

## Mode

AFK — ledger vs `RUN_LIMIT 8` is locked.

## Slice

migration `get_profile_circuit_ledger` → hook → `lib/profile` career PB in window → Circuits block + sparkline → vitest (first run ≠ PB, jetable out, last-8 line only)

## Dependencies

T225 (shell). **T237** (mocked-fold HITL pass). Window from `ProfileWindowContext`. Can land in parallel with T227 (ledger is not the session snapshot).

## Scope

### RPC

`get_profile_circuit_ledger()`: all complete catalog `block_runs` for `auth.uid()` (fingerprint, started_at, score inputs). Not `RUN_LIMIT 8`. Jetable (`benchmark_circuit_id` null) excluded.

### Algos

- Career PB: best complete run of that fingerprint across the **full ledger**; a window run is a **Profil Circuit PB** if it equals that career best **and** there is a prior complete run to beat.
- PBs stat = count of such runs with `started_at` in the current window.
- Sparkline: last 8 still fine for the line; ≥2 runs to draw.
- Type-aware AMRAP scoring: reuse `file:src/lib/amrapScore.ts`.
- Olympians `{n}/4` pill if already available from achievements — not a fourth stat invented here.

### UI

Replace Circuits fixture adapter. Jetable Tours stay in History — do not list them.

### Tests

- First complete Cindy is not a PB; second faster/higher is
- A PB outside last-8 still counts if the **window** contains that run
- Jetable run absent from ledger
- Sparkline hidden with a single run; last score still shown

## Out of Scope

- History shelf last-8 behavior
- Achievement grant paths
- Mixing jetable Circuits into Mix (already T228)

## Acceptance Criteria

- [ ] Ledger RPC returns catalog runs without `RUN_LIMIT 8`
- [ ] First complete run is not a PB; a later career-best in-window is
- [ ] Sparkline requires ≥2 runs; PB count uses full history
- [ ] Demoable: a Cindy PB older than 8 runs still increments PBs when the window includes that day
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief story 16
- Tech Plan: `get_profile_circuit_ledger`
- Glossary: **Profil Circuit PB**
