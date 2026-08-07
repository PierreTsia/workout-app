# T175 — Session prefill UI parity

## Goal

Align session UI prefill with slot-scoped progression: “last time” line and existing-slot weight prefill use the **Exercise Slot**; add/swap seed keeps catalog-global last weight. Addresses Epic stories **4, 6**.

## Mode

**AFK**

## Slice

`useLastSession → fetchLastWeightsForSlots → WorkoutPage wiring → vitest`

## Dependencies

T172.

**Deploy note:** Merge with T172–T174.

## Scope

| Item | Detail |
|---|---|
| `useLastSession` | Dual-id filter `(workout_exercise_id, exercise_id)` + block null; queryKey includes slot id |
| `fetchLastWeightsForSlots` | New; `Record<slotId, kg>` from latest matching solo log |
| `fetchLastWeightsForExerciseIds` | **Unchanged** — add/swap seed only |
| `WorkoutPage` | Existing-slot `weight === 0` prefill → slot weights; add/swap `lastWeightsQueryConfig([picked.id])` stays catalog |
| `ExerciseDetail` | Pass slot id into `useLastSession` |

### Tests

- Last-time summary for heavy slot ≠ light slot same catalog exo
- Slot weight fetch used for existing prefill path
- Catalog fetch still used for add/swap seed (regression)

## Out of Scope

- Engine suggestion computation (T173/T174)
- History / trends / PR pages (stay catalog-global)
- Redesigning seed UX

## Acceptance Criteria

- [ ] “Last time” on a dual-intent fixture shows the current slot’s last performance
- [ ] Existing-slot zero-template prefill uses slot last weight, not the other program’s
- [ ] Add/swap still seeds from catalog-global last weight
- [ ] Vitest covers slot vs catalog consumer split

## References

- Epic Brief stories 4, 6
- Tech Plan § last-weights split
- ADR 0012
