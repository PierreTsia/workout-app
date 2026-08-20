# T174 — Slot-scoped in-session engine path

## Goal

Make in-session **Progression Suggestion** and **Manual Override Window** read **Last Performance** for the current **Exercise Slot** (`workout_exercise_id` + `exercise_id`), including duration solos and post-swap bootstrap. Addresses Epic stories **1, 5, 7, 15, 16**.

## Mode

**AFK**

## Slice

`useLastSessionDetail → useProgressionSuggestion → ExerciseDetail / SetsTable → vitest`

## Dependencies

T172.

**Deploy note:** Merge with T172 + T173 + T175.

## Scope

| Item | Detail |
|---|---|
| `useLastSessionDetail` | Args: slot id + catalog id (or whole `WorkoutExercise`); `.eq` both; `.is("block_exercise_id", null)`; queryKey includes both |
| `useProgressionSuggestion` | Pass `exercise.id` + `exercise.exercise_id` into detail |
| Manual Override | Uses `lastSessionFinishedAt` from slot-scoped detail — no separate change |
| Swap | No matching `(slot, new_exercise_id)` → null Last Performance → template bootstrap |
| Duration | Same dual-id filter when `measurementType === "duration"` |

### Tests

- Detail query filters by slot + exercise (mock Supabase chain asserts filters)
- Suggestion for heavy slot ignores light-slot logs (fixture)
- After swap (same slot id, new exercise_id) → bootstrap / null last performance
- Block logs excluded even if same catalog id

## Out of Scope

- Pre-session RPC (T173)
- `useLastSession` UI line / last-weights (T175)
- Changing `progression.ts` rules

## Acceptance Criteria

- [ ] In-session suggestion for a dual-intent fixture uses the current slot’s last logs
- [ ] Editing template on slot A is not closed/opened by an unrelated catalog session on slot B (Manual Override scope)
- [ ] Swap onto a slot bootstraps from **Template Prescription** for the new movement
- [ ] Duration solos use the same slot key
- [ ] Query keys include slot id (no cross-slot cache bleed)
- [ ] Vitest covers dual-slot, swap bootstrap, block exclusion

## References

- Epic Brief stories 1, 5, 7, 15, 16
- Tech Plan § in-session reads
- ADR 0012
