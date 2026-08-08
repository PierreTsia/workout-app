# T173 — Slot-scoped pre-session suggestions

## Goal

Replace the catalog-global Last Performance RPC with `get_last_performance_for_slots` and wire `useProgressionSuggestionsForDay` so the pre-session day list shows **Progression Suggestion**s anchored on each **Exercise Slot**. Addresses Epic stories **1, 3**.

## Mode

**AFK**

## Slice

`migration (RPC) → useProgressionSuggestionsForDay → WorkoutPage pre-session list → vitest`

## Dependencies

T172.

**Deploy note:** Merge with T172 + T174 + T175; do not deploy alone.

## Scope

### RPC

- `DROP FUNCTION get_last_performance_for_exercises(uuid[])`
- Create `get_last_performance_for_slots(p_workout_exercise_ids uuid[], p_exercise_ids uuid[])`
- `DISTINCT ON (workout_exercise_id, exercise_id)`; filter `block_exercise_id IS NULL` and `workout_exercise_id IS NOT NULL`
- Return `workout_exercise_id` for client grouping

### Client

| Item | Detail |
|---|---|
| `useProgressionSuggestionsForDay` | Build parallel arrays from day’s solos; **throw** if lengths differ; RPC new name; group by slot id |
| Query key | Include slot ids (not only catalog ids) |
| Output | `Map<workout_exercises.id, ProgressionSuggestion \| null>` unchanged shape |
| Null / missing rows | `null` suggestion → template bootstrap (existing `buildPrescription` path) |

### Tests

- Dual-program / dual-slot fixture: same catalog exo → distinct suggestions (heavy ≠ light)
- RPC zip length mismatch throws
- Block logs never appear in RPC results (regression)

## Out of Scope

- In-session hooks (`useLastSessionDetail`) — T174
- `useLastSession` / last-weights split — T175
- Engine pure logic changes in `progression.ts`

## Acceptance Criteria

- [ ] Old RPC gone; new RPC granted to `authenticated`
- [ ] Pre-session list for a dual-intent fixture shows the heavy slot’s weight, not the light one’s
- [ ] Two slots of the same catalog exo on one day get independent suggestions
- [ ] Empty Last Performance for a slot → null suggestion / template bootstrap (no catalog-global fallback)
- [ ] QueryFn throws on unequal parallel arrays
- [ ] Vitest covers dual-slot + zip throw

## References

- Epic Brief stories 1, 3
- Tech Plan § RPC + `useProgressionSuggestionsForDay`
- ADR 0012
