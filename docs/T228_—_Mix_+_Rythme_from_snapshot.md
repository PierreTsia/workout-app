# T228 — Mix + Rythme from snapshot

## Goal

Wire Mix (exclusive **Mix slice** stacked 100%) and Rythme (presence rings, no min floor) from `useProfileSnapshot`. Skip-vs-plan rings stay out. Addresses Epic stories 9 (presence only), 10.

## Mode

AFK — slice precedence and grains are locked.

## Slice

`lib/profile/mixSlice` + rythme bucketing → Mix / Rythme blocks → `MixStackedChart` → vitest (precedence, Cindy vs jetable, grain ≤13 on 1 an)

## Dependencies

T227 (snapshot + session facts with `program_id` / `has_catalog_circuit`) — **not started**. T224 / T225 **done**. Do not start until T227 is committed.

## Scope

### Mix slice

Exclusive, one session one stack, precedence:

1. **Circuits** if the workout day has an **Exercise Block** with `benchmark_circuit_id` not null
2. else **Quick Workout** if `workout_days.program_id` is null
3. else **Programme**

Jetable Circuits never take (1). Shared helper used later by T234 SQL tests (export vectors).

Grain: 7=day, 30=ISO week, 100=ISO week, 365=month. (All-time year = T234.)

### Rythme

Presence by grain: empty rings are valid. No skip-vs-plan. No floor.

### UI

Replace Mix + Rythme fixture adapters. 0 sessions → Mix empty; Rythme all-empty is OK. Toujours still fixture or hide until T234 — if the toggle is `all`, keep Mix/Rythme on fixtures **or** show a clear “all-time in T234” empty; do not invent year bars from a 730d snapshot.

### Tests

- Programmed Cindy day → Circuits slice, not Programme
- Jetable Circuit on a Program day → Programme
- QW → Quick Workout
- 1 an Mix: `categories.length <= 13`

## Out of Scope

- All-time Mix year buckets (T234)
- Skip-vs-plan / “program dominates”
- Mix overlay / double-count

## Acceptance Criteria

- [ ] Mix bars use locked precedence; fixture/unit vectors cover Cindy, jetable, QW
- [ ] Rythme shows empty rings with no min-session floor
- [ ] 1 an Mix has at most 13 month categories
- [ ] Zero-session window: Mix empty; Rythme all-empty
- [ ] Demoable: a week with QW + Program + catalog Circuit shows three stacks, not a dump into Programme
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 9–10, success measure 14 (Cindy Mix)
- Tech Plan: mixSlice, grain table
- Glossary: **Mix slice**
