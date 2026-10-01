# T256 — Block a new session while one is open (B)

**Mode:** AFK · **Slice:** `WorkoutPage.startSession → OpenSessionDialog → openSessions/resumeSession → vitest`

## Goal

Kill trigger 2: before `startSession` commits, read the user's open sessions and, if one exists, make the user choose **Finish it** (close it with the last-set rule, then start) or **Resume it** (reopen it, cancel the start). This is the core of the epic. Addresses Epic Brief stories 2, 4, 7.

## Dependencies

- T254 (`openSessions.ts`, `sessionEvents.ts`)
- T255 (`resumeSession.ts`, `seedSessionMeta`)

## Scope

### `src/pages/WorkoutPage.tsx` (edit)

- Split `startSession` into a guard + an internal `commitStartSession(opts)`.
- Guard: `await findBlockingOpenSession(userId, session)`. If found, store `{ opts, orphan }`, open `OpenSessionDialog`, return. On query error: proceed (fail-open) and log.
- Both call sites route through the guard: the pre-session button (`file:src/pages/WorkoutPage.tsx:1244`) and `handleQuickWorkoutStart` (`file:src/pages/WorkoutPage.tsx:900-913`).
- On **Finish**: close the orphan (last-set rule, same payload as #568) + `session_orphan_closed { cause: "start_guard" }`, then `commitStartSession(pending.opts)`.
- On **Resume**: `resumeOrphanSession(orphan, userId)` + `session_orphan_resumed { surface: "start_guard" }`, clear the pending start.
- Emit `session_start_blocked` when the guard fires.

### `src/components/workout/OpenSessionDialog.tsx` (new)

- Dialog with `openSession.title` / `openSession.body` and two actions: `openSession.finish` (primary) and `openSession.resume` (outline). No dismiss that starts anyway.

### Tests

- `src/pages/WorkoutPage` integration (or a focused hook test): with an open session present, `startSession` does not flip the atom and opens the dialog; **Finish** closes the orphan then starts; **Resume** reopens the orphan and does not start; a query error proceeds.

## Out of Scope

- The app-open prompt (T257).
- The header finish affordance (T258).
- A third "start anyway" option — deliberately not offered (see Tech Plan Key Decisions).

## Acceptance Criteria

- [ ] Starting a session while an open one exists always surfaces the dialog; the atom is not flipped before the choice
- [ ] **Finish** closes the orphan with `finished_at = last set` (never `now()`) and then starts the new session
- [ ] **Resume** reopens the orphan on its day and does not start a new session
- [ ] A guard query error proceeds with the start (fail-open) and logs
- [ ] `session_orphan_closed { cause: "start_guard" }` and `session_start_blocked` are emitted
- [ ] EN + FR keys match the Tech Plan i18n contract (`openSession.*`)
- [ ] `npm test` green

## References

- Epic Brief `file:docs/Epic_Brief_—_Prevent_Orphan_Sessions_#571.md` (stories 2, 4, 7; scope B)
- Tech Plan `file:docs/Tech_Plan_—_Prevent_Orphan_Sessions_#571.md` (Key Decisions: Guard location / choices / failure mode)
- `file:src/pages/WorkoutPage.tsx:915-948`
