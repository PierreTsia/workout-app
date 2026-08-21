# T224 — Profil chart atoms

**Status:** done on `feat/512/profil-first-class-dashboard`.

## Goal

Prove the three Recharts atoms (stacked Mix, dual-axis Records combo, 13-axis radar) against shadcn `ChartContainer` with fixtures, so T0 is assembly not a Recharts debug. Addresses Epic stories 21.

## Mode

AFK — series contracts and “no green/red” are locked in the Tech Plan.

## Slice

`MixStackedChart` / `RecordsComboChart` / `MuscleRadarChart` → `ChartContainer` playground (admin or Story-less page section) → vitest (series length, dual YAxis present)

## Dependencies

None.

## Scope

### Chart atoms

| File | Contract |
|---|---|
| `file:src/components/profile/charts/MixStackedChart.tsx` | 100% stacked bars; categories + three stacks (Programme / Quick Workout / Circuits). No hooks. |
| `file:src/components/profile/charts/RecordsComboChart.tsx` | `ComposedChart` + dual `YAxis`: left = PR bars, right = RIR 0 rate. No green/red encoding. |
| `file:src/components/profile/charts/MuscleRadarChart.tsx` | `RadarChart` 13 `MUSCLE_TAXONOMY` axes; current series solid, prior dashed. |

Wrap each in `file:src/components/ui/chart.tsx` `ChartContainer`. If dual-axis fights the wrapper, custom SVG escape hatch is allowed — do not invent a fourth chart library.

### Playground

Absorbed into T225 `ProfilePage`. Charts live under `file:src/components/profile/charts/`.

### Tests

- Mix: `categories.length` matches fixture; stacks sum to 100 per category.
- Combo: two `YAxis`; a bucket with `rir0: null` does not plot `0`.
- Radar: 13 axes; prior series optional.

## Out of Scope

- `ProfilePage`, window toggle, `ProfileSection` (T225)
- Any RPC / snapshot (T227+)
- Pixel-matching the Cursor canvas

## Acceptance Criteria

- [x] Three presentational components take `categories` / `series` only — no `useQuery`
- [x] Combo has two Y axes; RIR null is a gap, not a zero
- [x] Radar has 13 axes from `MUSCLE_TAXONOMY`
- [x] Demoable: an admin can see all three charts with fixtures in one view
- [x] `npx tsc -p tsconfig.app.json --noEmit` and vitest for the new files pass with `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY=`

## References

- Epic Brief: `file:docs/Epic_Brief_—_Profil_first-class_dashboard_#512.md` (story 21)
- Tech Plan: charts decision, dual-axis escape hatch
- Canvas shape: `file:docs/visions/profile-mix-stacked.canvas.tsx`
