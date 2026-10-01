# T255 — Resume path: reopen an orphan session locally

**Mode:** AFK · **Slice:** `lib/resumeSession → syncService.seedSessionMeta → store/atoms → vitest`

## Goal

Give the app a way to reopen an orphan session whose local atom is gone: seed the sync metadata so new set logs land on the same real session, set `sessionAtom` on the orphan's workout day, and rebuild the sets table from the persisted `set_logs`. This is the shared dependency of the start guard (T256) and the app-open prompt (T257). Addresses Epic Brief story 5.

## Dependencies

- None. Uses `file:src/lib/syncService.ts` and `file:src/store/atoms.ts`.

## Scope

### `src/lib/syncService.ts` (edit)

- Add `seedSessionMeta(userId, localSessionId, meta: SessionMeta): void` — write-only, idempotent. Without it, `resolveSessionMeta` (`file:src/lib/syncService.ts:240`) mints a fresh UUID and the resumed session splits into two rows.

### `src/lib/resumeSession.ts` (new)

| Export | Detail |
|---|---|
| `resumeOrphanSession(orphan, userId)` | `seedSessionMeta(userId, local-${startedAtMs}, { realId: orphan.id, workoutDayId: orphan.workout_day_id, workoutLabelSnapshot: orphan.workout_label_snapshot, startedAt })`; then `store.set(sessionAtom, { ...defaultSessionState, isActive: true, startedAt, currentDayId: orphan.workout_day_id, activeDayId: orphan.workout_day_id, cycleId: orphan.cycle_id })`. |
| `hydrateSetsDataFromLogs(exercises, logs, library)` | Pure. Solo logs (`workout_exercise_id != null`) grouped by slot; each row `done: true`, `reps`/`weight`/`rir` from the log, or `kind: "duration"` with `loggedSeconds` when `duration_seconds != null`. Slots with no logs are omitted (the existing effect builds fresh rows). Block logs ignored. |
| `completedBlockIdsFromRuns(runs)` | Pure. Ids of `block_runs` with `finished_at != null`. |

### `src/pages/WorkoutPage.tsx` (edit)

- A `resumedRef` + effect: when `session.isActive` and `activeSessionLogs` has loaded, merge `hydrateSetsDataFromLogs(...)` into `setsData` once. Fetch `block_runs` for the session and set `completedBlockIds` once.

### Tests

- `src/lib/resumeSession.test.ts` — meta seeding (real id preserved), hydration mapping (reps / duration / rir / done), slots without logs untouched, block logs ignored.

## Out of Scope

- The UI entry points (T256, T257).
- Re-deriving PRs / achievements for the resumed session (#569).
- Full circuit resume: `completedBlockIds` is best-effort from `block_runs.finished_at`; an in-progress circuit is re-run (upsert on `(session_id, block_id)`).

## Acceptance Criteria

- [ ] `resumeOrphanSession` seeds `sessionMeta` so a subsequent `peekSessionRealId(userId, local-${startedAt})` returns the orphan's real UUID
- [ ] After resume, `sessionAtom` is active on the orphan's `workout_day_id` with its `cycle_id`
- [ ] `hydrateSetsDataFromLogs` marks already-logged solo sets `done: true` with their reps/weight/rir (or duration)
- [ ] A slot with no logs keeps its fresh rows
- [ ] `npm test` green; no new user-facing strings

## References

- Epic Brief `file:docs/Epic_Brief_—_Prevent_Orphan_Sessions_#571.md` (story 5)
- Tech Plan `file:docs/Tech_Plan_—_Prevent_Orphan_Sessions_#571.md` (Key Decisions: Resume mechanism / hydration)
- `file:src/lib/syncService.ts:240-291`, `file:src/components/workout/SetsTable.tsx:158`
