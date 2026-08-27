# T238 — Scorer + golden fixtures

## Goal

Land the pure **Program** scorer (`scoreProgram` + `bands.ts` + `toIntent`) with golden tests for the week as written. No UI. Unblocks cards and the **Program Page**. Addresses Epic stories 7–13, 22.

## Mode

AFK — bands and **Circuit in Program Scores** are locked in CONTEXT + Tech Plan.

## Slice

`types.ts` → `bands.ts` → `toIntent.ts` → `scoreProgram.ts` → vitest goldens

## Dependencies

None.

## Scope

### Module

`file:src/lib/programScore/` as Tech Plan **New Files**:

| File | Role |
|---|---|
| `types.ts` | `ProgramIntent`, `ProgramScore`, band union `'empty' \| 'short' \| 'ok' \| 'high'` |
| `bands.ts` | Hypertrophy 8–20 / 2–3 / rollup ⅓–⅔; strength 20/40 % and ≤6 / ≥150 s; endurance Circuit + dense-set rules |
| `toIntent.ts` | Map slim day rows → intent (taxonomy filter; snapshot fallback) |
| `scoreProgram.ts` | Pure function. Reuse `computeBalanceScore` / `MUSCLE_TAXONOMY`. Use `parseTargetRepRange` for strength. |

### Rules (do not re-decide)

- Intent only — no `set_logs`.
- **Circuits**: first-class; AMRAP = Tours for muscle math; never `rounds ×` sets.
- Hypertrophy grades programmed muscles only. Zeros → **Program Balance**.
- Strength / hypertrophy volume ignore Circuit set explosion. Frequency may hit from a station.
- Endurance: +1 per **Circuit**; dense solos (reps ≥ 12 or duration, rest ≤ 60).
- **Program Balance**: 13-vector, zeros kept; solo 1/0.5; station presence 1/0.5 once per block. Circuit-only week has a **number** (low), not `empty`.
- 0 days / 0 items → all scores `empty` (not `short`).
- Unknown muscle slugs dropped.

### Tests

Fixtures: empty, 1-day solo, PPL-shaped, 5×5-shaped, Cindy-only. Assert bands + facts (day/set/circuit counts, mix buckets) + Balance empty vs scored.

No `@/lib/supabase` import in this ticket.

## Out of Scope

- Hooks, cards, `/programs/:id` (T239, T240)
- i18n (T239+)
- ADR (T242)

## Acceptance Criteria

- [ ] `scoreProgram(intent)` is deterministic; goldens cover the five fixtures above
- [ ] Cindy-only: endurance + Balance scored; hypertrophy volume + strength `empty`; set count `0`; circuit count ≥ 1
- [ ] Empty week: all `empty`, facts zeros — not `short`
- [ ] 1-day solo week: hypertrophy may be `short` on frequency, not `empty`
- [ ] `bands.ts` is the only numeric source; tests import it (no duplicated literals)
- [ ] `npx tsc -p tsconfig.app.json --noEmit` + env-stripped `vitest` on the new files

## References

- Epic Brief stories 7–13, 22
- Tech Plan: Data Model, `scoreProgram`, Critical Constraints
- Glossary: **Goal Track**, **Program Balance**, **Circuit in Program Scores**
