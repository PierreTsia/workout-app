# T229 — Records + RIR 0 wiring

## Goal

Wire Records from the snapshot: **Profil PR** pairs (not `get_cycle_stats`), distinct exercises, days since last, combo bars + **RIR 0 rate** line. Circuit stations count because T226 landed. Addresses Epic stories 11, 12 (consumption).

## Mode

AFK — PR unit and RIR denominator are glossary-locked.

## Slice

`lib/profile` prPairs + rir0 → Records block → `RecordsComboChart` → vitest (duration PR, no impute 2, Circuit `was_pr`)

## Dependencies

T227 (snapshot sets). **T226** (`was_pr` on Circuit stations). T224 / T225.

## Scope

### Algos

- **Profil PR**: distinct `(session_id, exercise_id)` with ≥1 `was_pr` in the window, **duration included**.
- RIR 0 rate: num = `rir = 0`, den = `rir IS NOT NULL`. Null ≠ 2. Bucket with no declared RIR → no line point (not `0%`).
- Line needs ≥2 declared-RIR buckets to show; bars may render from 1.
- Do not read `get_cycle_stats.pr_count`.

### UI

Replace Records fixture adapter. Combo: no green/red. Stats: PR count, distinct exercises, days since last PR.

### Tests

- Fixture/session with a duration `was_pr` increments Records
- Circuit station `was_pr` increments the same counter
- No declared RIR → no line / no fake 0%
- Arch or unit: Records source is snapshot `was_pr`, not cycle_stats

## Out of Scope

- **Profil Circuit PB** / sparkline (T233)
- All-time Records year buckets (T234)

## Acceptance Criteria

- [ ] Duration PR in the window increments the Records count
- [ ] Weighted Circuit PR (from T226) increments the same count
- [ ] RIR line omitted or gapped when den = 0; never imputed default 2
- [ ] Combo line hidden when `< 2` declared-RIR buckets
- [ ] Demoable: admin Records on 30j matches a manual count of distinct PR pairs; `get_cycle_stats` can disagree and the UI follows snapshot
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 11–12, success measures 11–12
- Tech Plan: combo chart, snapshot SetFact
- Glossary: **Profil PR**, **RIR 0 rate**
