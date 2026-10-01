# T258 — Promote the finish affordance (D)

**Mode:** AFK · **Slice:** `useFinishSessionAttempt → FinishSessionButton → AppShell/WorkoutPage → vitest`

## Goal

Make finishing a partial session always reachable — including inside a circuit, where `WorkoutPage` returns early with only `BlockRunner` and the bottom nav (with its ghost « Finish workout early ») is not rendered. Addresses Epic Brief story 3.

## Dependencies

- None. Independent of T254–T257.

## Scope

### `src/hooks/useFinishSessionAttempt.ts` (new)

- Extract the confirm logic from `SessionNav` (`file:src/components/workout/SessionNav.tsx:71-101`): skipped count, remaining-ahead, `confirmBody`, `confirmOpen`, `confirmFinish`. Returns `{ attempt, confirmOpen, setConfirmOpen, confirmBody, confirmFinish }`.

### `src/components/workout/FinishSessionDialog.tsx` (new)

- The confirm dialog, rendered by `WorkoutPage` (moved out of `SessionNav`). Reuses the existing `finishSessionTitle` / `skippedSets` / `finishEarlyRemaining` / `finishEarlySkippedAndRemaining` keys.

### `src/components/workout/SessionNav.tsx` (edit)

- Drop the local dialog and confirm state; accept `onFinishAttempt` and call it from the primary button (when last) and the ghost button.

### `src/store/atoms.ts` (edit)

- Add `finishRequestAtom = atom(0)` (transient, not persisted).

### `src/components/workout/FinishSessionButton.tsx` (new)

- Header button, rendered when `session.isActive`. On click: if not on `/`, `navigate("/")`; then `setFinishRequestAtom(n => n + 1)`. Reuses the existing `finish` key.

### `src/components/AppShell.tsx` (edit)

- Render `FinishSessionButton` next to `SessionTimerChip`.

### `src/pages/WorkoutPage.tsx` (edit)

- Use `useFinishSessionAttempt`; render `FinishSessionDialog`; watch `finishRequestAtom` and call `attempt`.

### Tests

- `src/hooks/useFinishSessionAttempt.test.ts` — confirm fires when work remains, direct finish when none.
- `src/components/workout/FinishSessionButton.test.tsx` — sets the atom; navigates to `/` when elsewhere.

## Out of Scope

- Changing the finish payload or the close path.
- The start guard (T256) and the app-open prompt (T257).

## Acceptance Criteria

- [ ] A persistent **Finish** control is visible in the header whenever a session is active
- [ ] It is reachable inside a circuit (where the bottom nav is not rendered)
- [ ] Tapping it runs the same confirm flow as the bottom nav (one dialog, one source of truth)
- [ ] Tapping it on another route navigates to `/` and opens the confirm
- [ ] `SessionNav` no longer owns the confirm dialog
- [ ] `npm test` green; no new user-facing strings (reuses `finish`)

## References

- Epic Brief `file:docs/Epic_Brief_—_Prevent_Orphan_Sessions_#571.md` (story 3; scope D)
- Tech Plan `file:docs/Tech_Plan_—_Prevent_Orphan_Sessions_#571.md` (Key Decisions: Finish affordance / trigger / extraction)
- `file:src/components/workout/SessionNav.tsx:124-136`, `file:src/pages/WorkoutPage.tsx:995-1023`
