# T49 — Intra-Session Coaching Engine

## Goal

Replace the crude 3-bucket, weight-only `computeIntraSessionSuggestion` with a context-driven coaching engine that implements the full RIR × shortfall × equipment-tier rule table, fatigue bucket-shift, cascade logic with deload cap, and all supporting helpers. Everything lives in file:src/lib/rirSuggestion.ts as pure functions with comprehensive unit tests.

## Dependencies

None.

## Scope

### New types

| Type | Definition | Location |
|---|---|---|
| `AdjustmentTier` | `"weight-first" \| "reps-only"` | file:src/lib/rirSuggestion.ts |
| `CompletedSetInfo` | `{ reps: number; weight: number; rir: number }` | file:src/lib/rirSuggestion.ts |
| `RepRange` | `{ min: number; max: number }` | file:src/lib/rirSuggestion.ts |
| `IntraSessionContext` | `{ completedSets, currentRir, currentWeight, currentReps, targetRepRange, unit, equipment, tier }` | file:src/lib/rirSuggestion.ts |

Existing `WeightUnit` and `IntraSessionSuggestion` types remain unchanged.

### Helper functions

**`getAdjustmentTier(equipment: string, loggedWeight: number): AdjustmentTier`**
- `"weight-first"`: `barbell`, `dumbbell`, `ez_bar`, `machine`, `bench`, `kettlebell`
- `"reps-only"`: `bodyweight`, `cable`, `band`
- Unknown/`undefined` → `"weight-first"`
- Override: `bodyweight` with `loggedWeight > 0` → `"weight-first"`

**`parseTargetRepRange(exercise: WorkoutExercise): RepRange | null`**
- `rep_range_min` + `rep_range_max` (both > 0) → `{ min, max }`
- Else: regex `^(\d+)-(\d+)$` on `exercise.reps` → `{ min, max }`
- Else: regex `^\d+$` → `{ min: n, max: n }`
- Else → `null`
- Import `WorkoutExercise` from file:src/types/database.ts

**`detectFatigue(completedSets: CompletedSetInfo[]): boolean`**
- Requires 2+ sets with defined RIR
- Returns `true` if last 2+ show strictly declining RIR
- Does not trigger on flat, rising, or single-set sequences

### Coaching engine

**`computeIntraSessionSuggestion(ctx: IntraSessionContext): IntraSessionSuggestion`**

Steps:
1. Determine effective RIR via fatigue bucket-shift (see Tech Plan rule table)
2. Detect shortfall: `actual reps < targetRepRange.min`
3. Look up coaching rule for (effective bucket, shortfall, tier)
4. Compute weight and reps adjustments
5. Apply floors: weight >= 0, reps >= 1, weight-first floors at one increment

Rule table implemented exactly as specified in the Tech Plan's "Coaching Rule Table" section. Proportional reps deload for reps-only failure: `max(1, min(round(current × 0.85), current − 1))`.

**`computeCascadeSuggestions(completedSets, remainingCount, targetRepRange, unit, equipment): IntraSessionSuggestion[]`**

- Determines tier once from `originalWeight`
- Loops over remaining positions, calling `computeIntraSessionSuggestion`
- Deloads cascade (each suggestion feeds into next) but cap at `MAX_CASCADE_STEPS = 2` deload steps OR weight drop >= 2 increments
- Increases/holds apply to all remaining positions and stop

### Backwards-compatible shim

Export a deprecated wrapper with the old signature so the build stays green before T50 lands:

```typescript
/** @deprecated Use computeIntraSessionSuggestion(ctx) — removed in T50 */
export function computeIntraSessionSuggestionLegacy(
  prevRir: number, prevWeight: number, prevReps: string,
  unit: WeightUnit, equipment?: string,
): IntraSessionSuggestion
```

This calls the new engine with sensible defaults (no target range, no completed sets, tier from equipment + weight).

### Unit tests

File: file:src/lib/rirSuggestion.test.ts — rewrite/expand.

| Test group | Cases |
|---|---|
| `getAdjustmentTier` | All equipment values, unknown, bodyweight w/ weight > 0 |
| `parseTargetRepRange` | Structured fields, range string, fixed number, AMRAP, empty, `rep_range_min` only |
| `detectFatigue` | Declining (2 sets, 3 sets), flat, rising, single set, no RIR |
| `computeIntraSessionSuggestion` — weight-first | All 6 cells (3 RIR buckets × shortfall yes/no), fatigue shift, weight floors |
| `computeIntraSessionSuggestion` — reps-only | All 6 cells, proportional drop math, +1 cap at range max, suppressed weight |
| `computeIntraSessionSuggestion` — null range | RIR-only behavior, no shortfall detection |
| `computeCascadeSuggestions` | Deload cascade (2 steps then cap), increase (apply once then hold), hold (all same), mixed, single remaining set |
| Legacy shim | Mirrors current behavior for old callers |

## Out of Scope

- `SessionSetRow` changes (`manuallyEdited` flag) — T50
- `SetsTable.tsx` wiring (`confirmRir` batch loop, `updateField` flag) — T50
- UI changes (RirDrawer, ProgressionPill) — out of epic scope
- Cross-session progression — untouched

## Acceptance Criteria

- [ ] `getAdjustmentTier` returns correct tier for all 9 known equipment values + unknown + bodyweight-with-weight
- [ ] `parseTargetRepRange` handles structured fields, range strings, fixed numbers, and non-numeric strings
- [ ] `detectFatigue` correctly identifies strictly declining RIR sequences of length >= 2
- [ ] All 12 cells of the coaching rule table (6 per tier) produce correct weight/reps output
- [ ] Fatigue bucket-shift correctly downgrades effective RIR by one bucket
- [ ] Proportional reps deload: `round(current × 0.85)` with enforced min drop of 1 on failure
- [ ] `computeCascadeSuggestions` caps deload cascade at 2 steps
- [ ] `computeCascadeSuggestions` applies increase/hold to all remaining positions without compounding
- [ ] Legacy shim produces identical output to the old function for all existing test cases
- [ ] All existing `rirSuggestion.test.ts` tests pass (via legacy shim or migrated)
- [ ] `npx tsc --noEmit` passes — no type errors introduced

## References

- [Epic Brief — Smarter Intra-Session Set Adjustment](docs/Epic_Brief_—_Smarter_Intra-Session_Set_Adjustment.md)
- [Tech Plan — Smarter Intra-Session Set Adjustment](docs/Tech_Plan_—_Smarter_Intra-Session_Set_Adjustment.md) — sections: Key Decisions, Data Model, Coaching Rule Table, Cascade Behavior
