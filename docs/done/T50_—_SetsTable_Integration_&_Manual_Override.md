# T50 — SetsTable Integration & Manual Override

## Goal

Wire the new coaching engine (T49) into `SetsTable`, replacing the single-next-set update with a full cascade batch update of all remaining sets. Add a `manuallyEdited` flag to `SessionSetRow` so the engine respects user overrides. Remove the legacy shim from T49.

## Dependencies

- T49 — Intra-Session Coaching Engine (provides `computeCascadeSuggestions`, `parseTargetRepRange`, `getAdjustmentTier`, and all supporting types)

## Scope

### Data model: `manuallyEdited` flag

File: file:src/lib/sessionSetRow.ts

- Add `manuallyEdited?: boolean` to `SessionSetRowReps` and `SessionSetRowDuration`
- No change to `normalizeSessionSetRow` needed — `undefined` is falsy, which is the correct default for legacy rows
- No change to `buildInitialSetRowsForExercise` — new rows start without the flag (falsy = eligible for batch update)

### `SetsTable.updateField` modification

File: file:src/components/workout/SetsTable.tsx

Current behavior: unconditionally spreads `{ [field]: value }` onto the row.

New behavior:
1. Read the current value of the field before updating
2. If the new value differs from the old value AND the set is not done → spread `{ [field]: value, manuallyEdited: true }`
3. If the new value is the same → no-op (don't even update state)

This prevents false-positive locks from focus/blur without actual edits.

### `SetsTable.confirmRir` modification

File: file:src/components/workout/SetsTable.tsx

Replace the current single-next-set block:

```typescript
const nextIdx = setIdx + 1
if (nextIdx < exerciseSets.length && !exerciseSets[nextIdx].done) {
  // ... single set update
}
```

With a cascade batch:

1. **Collect completed sets:** iterate `exerciseSets[0..setIdx]` where `done && isRepsRow && rir !== undefined`, build `CompletedSetInfo[]`
2. **Parse target rep range:** call `parseTargetRepRange(exercise)` (exercise is the `WorkoutExercise` prop — `rep_range_min`, `rep_range_max`, and `reps` are all accessible)
3. **Identify eligible remaining sets:** `exerciseSets[setIdx+1..]` where `!done && !manuallyEdited && isRepsRow` — collect their indices
4. **Call `computeCascadeSuggestions`** with completed sets, eligible count, target range, unit, equipment
5. **Apply suggestions:** map the returned array to the eligible indices, spreading `{ weight: String(suggestion.weight), reps: suggestion.reps }` onto each row
6. **Single `setSession` call** with the full updated `exerciseSets` (existing behavior preserved)

Add `exercise.rep_range_min`, `exercise.rep_range_max`, `exercise.reps` to the `useCallback` dependency array (they come from the `exercise` prop so they're already captured by the `exercise` dep — verify this doesn't cause extra renders).

### Remove legacy shim

File: file:src/lib/rirSuggestion.ts

- Delete `computeIntraSessionSuggestionLegacy` (the backwards-compatible wrapper from T49)
- Update the import in file:src/components/workout/SetsTable.tsx to use the new `computeCascadeSuggestions` and helpers directly

### Update tests

File: file:src/components/workout/SetsTable.test.tsx

| Test case | What to verify |
|---|---|
| Batch update: all remaining sets get suggestions | Complete set 2 of 5 → sets 3, 4, 5 all update (not just set 3) |
| Manual override respected | Edit set 4 manually, complete set 2 → set 4 unchanged, sets 3 and 5 updated |
| Cascade deload | Complete set with RIR 0 → remaining sets show cascading weight/reps drop |
| Cascade cap | 5-set exercise, RIR 0 → deload stops compounding after 2 steps |
| Reps-only equipment | Bodyweight exercise → weight suppressed, reps adjust |
| Non-numeric reps passthrough | AMRAP prescription → no crash, reps unchanged |
| Duration sets skipped | Duration set rows are not affected by the batch update |

File: file:src/lib/rirSuggestion.test.ts

- Remove legacy shim tests (the shim is deleted)
- Verify existing new-engine tests still pass

## Out of Scope

- UI changes to the RirDrawer (0-4 scale stays as-is)
- Changes to ProgressionPill or cross-session logic (`useProgressionSuggestion`, `computeNextSessionTarget`)
- Duration exercise intra-session adjustments (no RIR drawer for timers)
- Persisting `manuallyEdited` to `set_logs` (ephemeral only)

## Acceptance Criteria

- [ ] `manuallyEdited?: boolean` added to `SessionSetRowReps` and `SessionSetRowDuration` in file:src/lib/sessionSetRow.ts
- [ ] `updateField` sets `manuallyEdited: true` only when the value actually changes and the set is not done
- [ ] `confirmRir` updates ALL remaining eligible (non-done, non-locked, reps) sets via `computeCascadeSuggestions`
- [ ] Manually edited sets are skipped by the batch update
- [ ] Deload cascade compounds across remaining sets up to the 2-step cap
- [ ] Increases apply to the next set and hold for the rest (no compounding)
- [ ] Bodyweight/cable/band exercises never produce weight changes (unless user logged weight > 0)
- [ ] Legacy shim removed from file:src/lib/rirSuggestion.ts — no dead code
- [ ] All existing `SetsTable.test.tsx` tests pass (updated where needed)
- [ ] `npx tsc --noEmit` passes
- [ ] Cross-session progression tests unchanged and passing

## References

- [Epic Brief — Smarter Intra-Session Set Adjustment](docs/Epic_Brief_—_Smarter_Intra-Session_Set_Adjustment.md)
- [Tech Plan — Smarter Intra-Session Set Adjustment](docs/Tech_Plan_—_Smarter_Intra-Session_Set_Adjustment.md) — sections: Component Architecture (SetsTable modifications), Cascade Behavior, Failure Mode Analysis
- [T49 — Intra-Session Coaching Engine](docs/T49_—_Intra-Session_Coaching_Engine.md)
