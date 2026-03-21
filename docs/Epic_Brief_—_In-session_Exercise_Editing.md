# Epic Brief — In-session Exercise Editing

## Summary

Users can **swap**, **delete**, or **add** exercises **while a workout is active** — the same mental model and UI patterns as [pre-session exercise editing](Epic_Brief_—_Pre-session_Exercise_Editing.md) ([issue #83](https://github.com/PierreTsia/workout-app/issues/83)). Every action passes through **Just this session** (local / ephemeral for this run) vs **Apply permanently** (mutate the user’s own `workout_exercises` for that day, identical semantics to the Builder and pre-session permanent path). **Permanent** still means: future definition of that day only — never rewriting past `set_logs` or shared catalog rows.

**Swap** must keep the **same `workout_exercises` row id** so in-memory `setsData` keys and queued sync stay coherent; the row’s `exercise_id` and snapshots update so logged work attributes to the **new** movement (see `file:docs/Tech_Plan_—_Pre-session_Exercise_Editing.md`). **Delete** when the user has already logged sets for that row requires an explicit warning that those records will be removed. **Add** appends to the end of the day’s list (session-only or permanent).

**Smart Swap** ([issue #43](https://github.com/PierreTsia/workout-app/issues/43)) is not implemented as a standalone feature in the codebase today; this epic **unifies entry points** (same pickers and scope dialog as pre-session) so smarter suggestions can plug in later without a parallel UX.

GitHub: [issue #92](https://github.com/PierreTsia/workout-app/issues/92). Builds on `file:src/pages/WorkoutPage.tsx` (pre-session branch already uses `PreSessionExerciseList`, `ExerciseEditScopeDialog`, and `executeScopeChoice`); active session today is `ExerciseStrip` + `ExerciseDetail` + `SessionNav` without list edit affordances.

---

## Context & Problem

**Who is affected:** Anyone who started a program day (or quick workout) and discovers mid-session that equipment, time, or energy does not match the plan.

**Current state:**

- **Pre-session editing** is implemented: `file:src/components/workout/PreSessionExerciseList.tsx`, `file:src/components/workout/ExerciseEditScopeDialog.tsx`, structured patch in `file:src/types/preSessionOverrides.ts`, merge via `file:src/lib/mergeWorkoutExercises.ts`, mutations orchestrated in `file:src/pages/WorkoutPage.tsx` (`executeScopeChoice`). Pickers: `file:src/components/generator/ExerciseSwapPicker.tsx`, `file:src/components/generator/ExerciseAddPicker.tsx`, `file:src/components/workout/SwapExerciseSheet.tsx`; pool: `file:src/hooks/useExerciseLibrary.ts`.
- **Active session** (`session.isActive` in `file:src/store/atoms.ts`) shows `file:src/components/workout/ExerciseStrip.tsx` and `file:src/components/workout/ExerciseDetail.tsx`. Navigation uses **`exerciseIndex`** on `sessionAtom` (there is **no** separate `activeExerciseId` atom). The user cannot swap, add, or delete exercises from this view without leaving the flow or finishing and editing elsewhere.
- **Set logging** keys `session.setsData` by **`workout_exercises.id`** (row id); sync uses `exercise_id` on the row for `set_logs` — the pre-session tech plan’s swap identity rule applies directly here.

**Pain points:**

| Pain | Impact |
|---|---|
| Locked in after **Start** | Cannot adapt when the bench is taken or a joint complains |
| Parity gap vs pre-session | Same product promise (“adjust my day”) but only before the clock runs |
| Smart swap as orphan concept (#43) | No single place in the product for “replace this movement” mid-flow |

---

## Goals

| Goal | Measure |
|---|---|
| In-session parity with pre-session | From an active session on a day with exercises, user can swap, delete, or add at least once each (where product allows — e.g. read-only modes excluded) with the same scope dialog pattern |
| Shared componentry | **100% reuse** of scope dialog, swap/add pickers, and sheet patterns used pre-session — no duplicate picker or swap modal for in-session only ([issue #92](https://github.com/PierreTsia/workout-app/issues/92) critique) |
| Safe navigation state | After delete or list-shrinking operations, **`exerciseIndex`** (and locked-day view index if applicable) always points at a valid row or a defined fallback (e.g. clamp to `0` or previous neighbor) — never an out-of-range index |
| Data integrity | Swap preserves row id and remaps logged sets to new `exercise_id` per existing architecture; delete with any **done** or persisted-log risk triggers explicit destructive confirmation copy |
| Smart Swap readiness | UX entry points align with #43 so “suggested replacements” can ship as an enhancement inside the same flow (not a second route) |

---

## Scope

**In scope:**

1. **Edit affordances on active session** — Same **Edit** / actions as pre-session (Swap, Delete, Add) on the surfaces users already focus on during a set (exact placement: strip vs detail vs overflow — **Tech Plan**). Visual and interaction parity with pre-session within shared components.
2. **`ExerciseEditScopeDialog`** — Reuse `file:src/components/workout/ExerciseEditScopeDialog.tsx` and the same i18n keys under `file:src/locales/en/workout.json` / `file:src/locales/fr/workout.json` (extend only if in-session copy needs a single extra string, e.g. delete warning).
3. **Session-only vs permanent** — Reuse the same mutation paths as pre-session (`executeScopeChoice` or extracted shared helper) for permanent writes; session-only continues to use the structured patch (`PreSessionExercisePatch` / merge) **while the session is active**, without persisting `workout_exercises` until the user chooses permanent.
4. **Swap** — Same rules as pre-session / tech plan: keep row id, update `exercise_id` + snapshots + weight resolution from user history for the **new** exercise; **`setsData[rowId]`** remains the container for in-progress sets so nothing “orphans” mid-session.
5. **Delete** — If the user has **logged or completed** work for that row in the current session (or any criterion the Tech Plan defines to match “you will lose stats”), show a **second-line confirmation** beyond scope: e.g. “You have logged sets for this exercise. Deleting it will remove these records.” Permanent delete uses existing server delete; session-only removes row from merged list and drops `setsData[rowId]`.
6. **Add** — Append-only; same picker as pre-session; scope dialog after selection.
7. **Quick Workout** — **In scope** for v1: quick days are still user-owned `workout_exercises` rows; in-session add/swap/delete should work the same unless a technical blocker appears (Tech Plan must call out if `program_id` null paths differ).
8. **Cross-day read-only** — When `isViewingLockedDay` (user browses another day while a session is active on another), **no** edit actions — same spirit as read-only detail.

**Out of scope:**

- Reordering exercises mid-session (Builder / pre-session rules unchanged).
- Changing sets/reps/rest **prescription** inline on the edit flow (unless already shared with pre-session; default defer to existing **active session** editors).
- Implementing the full **Smart Swap** ranking / equipment substitution algorithm before #43 exists — this epic **wires the unified flow**; smarter defaults land under #43 or a follow-up ticket.
- Rewriting historical `set_logs` when applying permanent changes (same as pre-session).

---

## Success Criteria

- **Numeric:** After a permanent add/delete/swap mid-session, `["workout-exercises", dayId]` reflects the change when online; session-only edits never write `workout_exercises`.
- **Qualitative:** Users cannot distinguish “which codebase path” they used — pre-session vs in-session scope dialogs and picker behavior match.
- **Qualitative:** After any list mutation, the strip and detail show a consistent current exercise; no blank state from stale `exerciseIndex`.
- **Qualitative:** Delete path that loses logged data always shows an explicit warning; no silent removal of stats the user cares about.
- **Qualitative:** E2E or integration coverage exists for at least one swap and one delete path in active session (align with `file:e2e/pre-session-editing.spec.ts` patterns).

---

## Open decisions (gap analysis)

| Topic | Notes |
|---|---|
| **Delete confirmation threshold** | Confirm only when `some(set => set.done)` vs any partial progress vs synced logs only — Tech Plan must pick one consistent rule. |
| **Permanent apply failures mid-session** | Mirror pre-session: surface `preSession.mutationError` (or shared key), keep local session state recoverable. |
| **#43 timeline** | Until shipped, same-muscle / full-library pickers suffice; document extension point for “suggested” section in picker or sheet. |

---

## Working assumptions (for Tech Plan; validate with PM)

1. **Single merge source** — The active session continues to render `mergeWorkoutExercises(base, preSessionPatch)` (or renamed shared patch) so pre-session edits before start and in-session session-only edits use **one** representation. Tech Plan may extract patch + executor from `WorkoutPage` into a hook or module to avoid duplicated logic.
2. **`exerciseIndex` is the critical pointer** — On delete, clamp or reassign index; on swap, index may stay the same; on add at end, optional product choice whether to **jump** to the new exercise (default: stay on current unless UX specifies).
3. **Parity with #83** — “Apply permanently” copy and progression hints match pre-session; no new semantic for the same buttons.
4. **Shared components** — Any new wrapper for “row actions” should accept the same callbacks/picker props as `PreSessionExerciseList` to satisfy the “100% shared” constraint; avoid forking `ExerciseSwapPicker` behavior per surface.

When ready, say **create tech plan** to continue.
