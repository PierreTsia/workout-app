# T172 — Persist Exercise Slot on set_logs

## Goal

Make every solo `set_log` carry its **Exercise Slot** identity (`workout_exercise_id`) and widen `log_slot` so two same-catalog solos in one session don’t collide. **No** eager historical backfill — legacy solos stay NULL → template bootstrap. Unlocks slot-scoped reads in T173–T175. Addresses Epic stories **2** (write side), **8–11**.

## Mode

**AFK** — decisions locked in ADR 0012 / Tech Plan; mechanical to verify.

## Slice

`migration → database.ts → syncService (payload + fingerprint + upsert) → SetsTable enqueue → vitest`

## Dependencies

None.

**Deploy note:** Do not deploy this ticket alone to production — merge with T173–T175 stack (#463) so reads and writes land together.

## Scope

### Migration

- Add `set_logs.workout_exercise_id uuid NULL REFERENCES workout_exercises(id) ON DELETE SET NULL`
- Index `(workout_exercise_id, exercise_id, logged_at DESC)` partial where NOT NULL
- **No** eager historical backfill (deleted dual-intent siblings make “unique now” unsafe — ADR 0012 §3)
- Recreate generated `log_slot = COALESCE(block_exercise_id, workout_exercise_id, exercise_id)` + unique `(session_id, log_slot, set_number)`
- **Do not** create/replace the progression RPC here (T173)

### Write path

| Item | Detail |
|---|---|
| `SetLogPayload*` | Optional `workoutExerciseId?: string \| null` |
| Queue fingerprint | `blockExerciseId ?? workoutExerciseId ?? exerciseId` |
| `processSetLog` | Upsert column `workout_exercise_id` |
| `SetsTable` | Both enqueue sites pass `workoutExerciseId: exercise.id` |
| Block path | Leave null / omit (`useBlockSession` unchanged) |
| `SetLog` type | Add `workout_exercise_id` (+ missing `prescribed_*` if still absent) |

### Tests

- Queue: two solos same `exerciseId`, different `workoutExerciseId` → two queue items
- Upsert row includes `workout_exercise_id`
- Legacy payload without field → null column (no throw)
- Block payload still omits / nulls slot FK

## Out of Scope

- RPC / read-path changes (T173–T175)
- Catalog-global history / PR queries
- Pedagogical UI

## Acceptance Criteria

- [ ] Migration applies cleanly; `log_slot` expression includes `workout_exercise_id`
- [ ] Pre-migration solos keep `workout_exercise_id` NULL (no guessed attachments)
- [ ] Solo enqueue from `SetsTable` persists `workout_exercise_id = workout_exercises.id`
- [ ] Two same-catalog solos in one session upsert as distinct rows (no clobber)
- [ ] Offline payload without `workoutExerciseId` upserts with null FK (no crash)
- [ ] Vitest covers fingerprint split + upsert column
- [ ] Stack note respected: not shipped to prod without T173–T175

## References

- Epic Brief: `file:docs/Epic_Brief_—_Slot-Scoped_Last_Performance_#463.md` (stories 2, 8–11)
- Tech Plan: `file:docs/Tech_Plan_—_Slot-Scoped_Last_Performance_#463.md` (migration + write path)
- ADR: `file:docs/adr/0012-slot-scoped-last-performance.md`
