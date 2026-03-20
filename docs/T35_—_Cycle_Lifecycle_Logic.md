# T35 — Cycle Lifecycle Logic

## Goal

Wire up the cycle lifecycle: hooks to query cycles and derive progress, sync service extension to persist `cycle_id` on sessions, and WorkoutPage integration for cycle creation at "Start Workout" and `cycleId` passing at session finish. After this ticket, cycles are fully functional behind the scenes — the UI still looks the same.

## Dependencies

- T34 — Cycles Schema, Types & Atom

## Scope

### Cycle hooks

Create `file:src/hooks/useCycle.ts`:

**`useActiveCycle(programId: string | null)`**
- Query key: `["active-cycle", programId]`
- Queries `cycles` where `program_id = ?` and `finished_at IS NULL`, single row
- Handles `PGRST116` → `null`
- `enabled: !!programId`

**`useCycleProgress(cycleId: string | null, days: WorkoutDay[])`**
- Query key: `["cycle-sessions", cycleId]`
- Queries `sessions` where `cycle_id = ?` and `finished_at IS NOT NULL`
- Derives `{ completedDayIds, totalDays, nextDayId, isComplete }` via `useMemo`

### Sync service extension

In `file:src/lib/syncService.ts`:

- Add `cycleId` to `enqueueSessionFinish` parameters and `SessionFinishPayload` type
- Include `cycle_id` in the session upsert payload
- Add `["active-cycle"]` and `["cycle-sessions"]` to drain cache invalidation

### WorkoutPage integration

In `file:src/pages/WorkoutPage.tsx`:

- On "Start Workout": resolve active cycle via `useActiveCycle`, or create one via Supabase insert. Store `cycleId` in `sessionAtom`. Handle offline fallback (`cycleId = null`). Handle unique constraint race (refetch existing).
- On finish: pass `session.cycleId` to `enqueueSessionFinish`. Optimistically update `["cycle-sessions", cycleId]` cache.
- Reset `cycleId` to `null` when session atom resets.

### Tests

- Unit tests for `useCycleProgress` derivation logic (completed days, nextDayId, isComplete)
- Verify `enqueueSessionFinish` includes `cycle_id` in payload

## Out of Scope

- Carousel UI (T36)
- Cycle progress header, completion banner, reset day action (T37)
- i18n keys (T36/T37)

## Acceptance Criteria

- [ ] `useActiveCycle` returns the active cycle for a program, or `null` if none
- [ ] `useCycleProgress` correctly derives completed days, total, next day, and isComplete
- [ ] `enqueueSessionFinish` includes `cycle_id` in the Supabase upsert
- [ ] Drain invalidates `["active-cycle"]` and `["cycle-sessions"]` query keys
- [ ] Starting a workout creates a cycle if none exists, reuses if one does
- [ ] Offline start gracefully falls back to `cycleId = null`
- [ ] Session finish optimistically updates cycle-sessions cache
- [ ] All existing tests pass, `npm run build` succeeds

## References

- [Epic Brief](docs/Epic_Brief_—_Workout_Overview_Session_Cards.md) — PR A items 4-6
- [Tech Plan](docs/Tech_Plan_—_Workout_Overview_Session_Cards.md) — PR A sections (hooks, cycle start flow, session finish extension)
