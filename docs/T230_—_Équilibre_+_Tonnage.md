# T230 — Équilibre + Tonnage wiring

## Goal

Wire **Équilibre** (score + 13-axis radar, ≥3 sessions) from existing `get_volume_by_muscle_group` + prior offset, and **Tonnage** from snapshot loaded sets (Circuit load in, BW 0 kg out, not SUM of radar). Two equal columns on desktop. Addresses Epic stories 13, 14.

## Mode

AFK — floors and tonnage formula are locked.

## Slice

`get_volume_by_muscle_group(days, offset)` → radar VM → `MuscleRadarChart` + `lib/profile` tonnage from snapshot → 2-col Preuve layout → vitest (`hasEnoughBalanceData`, Cindy 0 t)

## Dependencies

T227 (snapshot for Tonnage). T224 / T225 (radar atom + layout). Bounded volume RPC already exists — do not wait on T234.

## Scope

### Équilibre

- Reuse `file:src/hooks/useVolumeDistribution.ts` pattern: `p_days` + `p_offset_days` for vs-préc. (except when `includeDeltas === false`).
- Score via existing `computeBalanceScore` / **sets** credits (1 / 0.5), not kg.
- Floor: ≥3 finished sessions in the window (`hasEnoughBalanceData`). 2 sessions in 7d → empty radar/score; Tonnage may still `ok`.
- Do **not** import `BalanceTab` or the History body map.

### Tonnage

- `Σ weight_logged × numeric reps` where `weight_logged > 0` and duration is out.
- Circuit loaded sets **in**. Do not filter `block_exercise_id` or `equipment`.
- Do not `SUM` radar `total_volume_kg`.
- Floor: ≥1 loaded set else empty.
- Cindy-only day: Mix (already T228) Circuits, Tonnage 0 t / empty if all weights 0.

### Layout

Keep T225 2-col desktop / stacked mobile. Replace fixture adapters only.

### Tests

- 2 sessions → Équilibre empty; Tonnage can render
- Cindy 0 kg sets → Tonnage empty or 0 t, not radar-sum
- Loaded Circuit deadlift counts in Tonnage

## Out of Scope

- `get_volume_by_muscle_group_all_time` (T234)
- History Balance 30d changes
- Agonist pairs / body map on Profil

## Acceptance Criteria

- [ ] Équilibre uses volume RPC + existing score; `< 3` sessions → empty, not a fake radar
- [ ] Tonnage uses snapshot loaded sets; radar kg is not the source
- [ ] Loaded Circuit set increments Tonnage; 0 kg Cindy does not
- [ ] Desktop: radar \| Tonnage two columns
- [ ] Demoable: 7d with two sessions shows pulse/Mix but Équilibre empty; adding a third session reveals the radar
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 13–14, success measures 13–14
- Tech Plan: bounded volume reuse, tonnage constraint
- Glossary: **Tonnage**, **Profil not-enough-data**
