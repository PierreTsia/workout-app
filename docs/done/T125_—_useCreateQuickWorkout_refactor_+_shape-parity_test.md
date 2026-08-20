# T125 — Refactor `useCreateQuickWorkout` + shape-parity test

## Goal

Collapse the AI-vs-deterministic shape drift risk **by construction**: refactor `useCreateQuickWorkout` to call the same `buildWorkoutExerciseInsertRowsForDay` helper that the new `create_workout_day` MCP tool uses (T124), and lock the equivalence with a mandatory regression test. After this lands, the deterministic Quick Workout path and the AI Quick Workout path produce byte-equivalent `workout_exercises` rows for the same `GeneratedWorkout` input.

Addresses **Epic Brief story 21** (`useCreateQuickWorkout` survives but its caller surface narrows) and the **mandatory shape-parity test** locked in the Brief's success measures.

## Mode

**AFK** — pure code refactor, deterministic test, no UX surface changes.

## Slice

`src/hooks/useCreateQuickWorkout.ts` (refactor) → `src/lib/programPersistence.ts` (re-use existing helper) → Vitest parity test

## Dependencies

- **T124** — the parity test compares against the row shape that `create_workout_day` produces; the MCP tool must exist (the test does NOT call MCP live — it compares the SAME `buildWorkoutExerciseInsertRowsForDay` helper that T124's tool uses, since web and Edge ports are kept in sync per `file:supabase/functions/mcp/lib/programPersistence.ts:1-10`).

## Scope

### Refactor `useCreateQuickWorkout`

| File | Change |
|---|---|
| `file:src/hooks/useCreateQuickWorkout.ts` | Replace inline row construction (lines 34-60) with `buildWorkoutExerciseInsertRowsForDay` from `file:src/lib/programPersistence.ts`. The hook should construct a `GeneratedExerciseForProgram[]` from `workout.exercises` (mapping `GeneratedExercise → GeneratedExerciseForProgram`) and pass that to the helper. The `workout_days` insert (label/emoji/sort_order/program_id/saved_at) stays in the hook. |

The mapping `GeneratedExercise → GeneratedExerciseForProgram` is mostly direct: `exercise → exercise` (with `id`, `name`, `muscle_group`, `emoji`, `equipment`, `measurement_type`, `default_duration_seconds`), `sets / reps / restSeconds` carry over. Quick Workout doesn't set `weightKg` / `repRangeMin` / `repRangeMax` / `setRangeMin` / `setRangeMax` / `targetDurationSeconds` — they stay `undefined` so the helper uses its auto-derive branch (matching today's behavior).

### Mandatory shape-parity test

Location: `file:src/hooks/useCreateQuickWorkout.test.ts` (new) or co-located parity spec under `src/lib/`.

Test asserts that for a representative set of `GeneratedWorkout` inputs (reps-mode, duration-mode, bodyweight, mixed), **both call paths produce equivalent rows**:

```typescript
// Pseudocode
const workout = makeGeneratedWorkout(...)

// Path A — useCreateQuickWorkout's row construction (post-refactor)
const aRows = buildRowsViaHook(workout, dayId)

// Path B — same helper used by create_workout_day
const bRows = buildWorkoutExerciseInsertRowsForDay(dayId, mapToGeneratedExerciseForProgram(workout.exercises))

expect(aRows).toEqual(bRows)
```

**Compared fields**: all 19 columns of `workout_exercises` (deep-equal). Plus, in a separate assertion, the relevant `workout_days` fields produced by the hook for a live workout: `label`, `emoji`, `sort_order`, `program_id`. **Excluded fields**: `id`, `user_id`, `created_at` (assigned at insert), `saved_at` (the *intentional* difference between drafts and live workouts — drafts set it, `create_workout_day` always leaves it `NULL`).

After the refactor, this is a regression test against future drift — not a "do they match today" probe.

### Test cases (minimum)

| Case | Input | Expectation |
|---|---|---|
| Reps-mode, weighted | Bench Press 4×8 with `weight: "0"` (deterministic generator never sets weight) | Equivalent rows; `target_duration_seconds: NULL`; auto-derived range bounds |
| Duration-mode | Plank 4 sets, 30s default | Equivalent rows; `reps: "0"`; `target_duration_seconds: 30`; auto-derived duration ranges |
| Bodyweight | Push-ups 3×12 | Equivalent rows; `weight: "0"`; `max_weight_reached: true` |
| Mixed (full workout) | Squat + Plank + Push-ups | Equivalent rows for all three, ordered by `sort_order` |
| Numeric reps as string ("8-12") | A double-progression range that the deterministic path doesn't actually emit, but covers the helper's range-parsing | Equivalent rows; ranges respected |

## Out of Scope

- Changes to the AI Start path (still on `useCreateQuickWorkout` until T128)
- Changes to `useAIGenerateWorkout` (deleted in T127)
- Edge function or MCP tool changes (T124 / T127 / T128)
- DB schema changes
- Save-as-draft logic changes (`saved_at` semantics stay as today)

## Acceptance Criteria

- [ ] `useCreateQuickWorkout.ts:34-60` no longer contains inline row construction; the hook delegates to `buildWorkoutExerciseInsertRowsForDay` from `src/lib/programPersistence.ts`.
- [ ] Existing `useCreateQuickWorkout` consumers (`QuickWorkoutSheet`'s deterministic Start, AI Start, save-as-draft on both paths) continue to work unchanged from a black-box perspective — verified by manual smoke (open Quick Workout sheet → deterministic generate → Start → see workout in upcoming).
- [ ] Vitest parity test passes for at least the 5 cases listed above. Test deep-equals all 19 `workout_exercises` columns and the 4 prescription-relevant `workout_days` fields (`label`, `emoji`, `sort_order`, `program_id`); excludes `id`, `user_id`, `created_at`, `saved_at`.
- [ ] Parity test runs in `npm test` (Vitest), no Supabase / no MCP live calls — purely helper-vs-helper.
- [ ] No regressions in existing `useCreateQuickWorkout` tests (if any). If none exist today, this ticket adds the mapping coverage anyway.
- [ ] `git grep` confirms no remaining inline references to `rep_range_min`, `rep_range_max`, `set_range_min`, `set_range_max`, `duration_range_min_seconds` etc. in `useCreateQuickWorkout.ts` (those are now hidden behind the helper).

## References

- [Epic Brief — Quick Workout AI to Embedded Agent + MCP (#342)](./Epic_Brief_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — story 21 (`useCreateQuickWorkout` survives), success measures (mandatory parity test)
- [Tech Plan — Quick Workout AI to Embedded Agent + MCP (#342)](./Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — sections "Modified files → useCreateQuickWorkout.ts", "Test Strategy → Shape parity"
- [ADR 0002 — Quick Workout AI MCP migration](./adr/0002-quick-workout-ai-mcp-migration.md) — §5 (`useCreateQuickWorkout` survives)
- Reference: `file:src/lib/programPersistence.ts` (the helper to call), `file:src/hooks/useCreateQuickWorkout.ts:34-60` (the inline construction to replace)
