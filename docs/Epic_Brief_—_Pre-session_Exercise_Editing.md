# Epic Brief — Pre-session Exercise Editing

## Summary

Users can adjust the exercise list on the main workout screen **before** tapping **Start Workout**: swap an exercise for another from the library, remove one, or add one. Every such action asks whether the change applies **only to the upcoming session** (local override, no DB write) or **permanently** to the program template (Supabase `workout_exercises` rows, with query invalidation). This closes the gap between “I see my day” (post–[Workout Overview / session cards](Epic_Brief_—_Workout_Overview_Session_Cards.md)) and “I’m ready to train” without opening the Builder first.

GitHub: [issue #83](https://github.com/PierreTsia/workout-app/issues/83). Parent UI context: PR #82 / `file:src/pages/WorkoutPage.tsx` pre-session branch and `file:src/components/workout/ExerciseListPreview.tsx`.

---

## Context & Problem

**Who is affected:** Anyone using a saved program who lands on `/` and reviews the day’s exercises before starting.

**Current state:**

- Pre-session UI shows a read-only list (`ExerciseListPreview` driven by `useWorkoutExercises` + `previewItems` in `file:src/pages/WorkoutPage.tsx`).
- Template changes require the Builder (`file:src/hooks/useBuilderMutations.ts`).
- The generator preview flow already has swap/add patterns (`file:src/components/generator/PreviewStep.tsx`, `ExerciseSwapPicker`, `ExerciseAddPicker`) but they are not wired to the workout home screen or to Supabase.
- `file:src/hooks/useExercisesForGenerator.ts` filters by equipment and muscle groups — it is **not** suitable as the universal picker pool; a dedicated full-library query (e.g. `useExerciseLibrary`) is required for pickers on this screen.
- The Workout Overview epic once listed “exercise swap from the overview card” as out of scope during **active session** focus; **issue #83 explicitly adds pre-session editing**. This epic supersedes that omission for the pre-start path only.

**Pain points:**

| Pain | Impact |
|---|---|
| Wrong machine or mood — user wants a different exercise before starting | Must leave flow, edit Builder, return — high friction |
| One-off substitution (travel, injury) | No way to tweak a single run without mutating the program |
| No parity with generator “preview before start” | Generator users can swap/add; program users cannot |

---

## Goals

| Goal | Measure |
|---|---|
| Pre-session edit parity | From `/`, user can swap, delete, or add at least one exercise and start with the updated list without visiting Builder (for session scope) or with template updated (for permanent scope) |
| Clear scope choice | 100% of destructive/template-changing actions pass through an explicit **Just this session** vs **Apply permanently** decision |
| No regression to active session | In-session `ExerciseStrip` / `ExerciseDetail` / set logging behavior unchanged for the same logical exercise list |
| Library coverage for pickers | Pickers receive a full exercise list (same source of truth as the library), with acceptable load time on warm cache (target: under ~1s after first fetch, per PRD PWA expectations) |

---

## Scope

**In scope:**

1. **UI entry points** — On the pre-session view for a **program day** (not quick workout in v1), each row in the exercise preview (or equivalent affordances) supports actions: **Swap**, **Delete**, **Add** (add inserts at end or opens add picker; exact control layout left to Tech Plan).
2. **`ExerciseEditScopeDialog`** — After the user chooses an exercise (swap/add) or confirms delete, show a dialog: **Just this session** vs **Apply permanently** (copy i18n-ready).
3. **Session-only path** — Local state on `WorkoutPage` (e.g. `exerciseOverrides`) merges with `useWorkoutExercises` data to produce the list used for preview and for initializing the active session. No Supabase mutation. Overrides **clear** when: the user **changes the selected program day** (carousel); after **Start Workout** the in-session list is the frozen result of that merge (override state may reset once active); when the user completes the session and hits the flow that resets session atom (`handleNewSession` / equivalent). **Page reload** clears session-only overrides (acceptable).
4. **Permanent path** — **Add:** `useAddExerciseToDay` with correct `sort_order`. **Delete:** `useDeleteExercise`. **Swap:** not covered by existing mutations — implement updating the `workout_exercises` row (exercise identity + snapshot fields) while **preserving** sets, reps, weight, rest, and `sort_order` unless Product revises in Tech Plan.
5. **`useExerciseLibrary`** — `useQuery` loading all exercises (e.g. `from("exercises").select("*").order(...)`) for picker `pool` props; no equipment/muscle filter at the hook level (pickers may still filter — `ExerciseSwapPicker` keeps same-muscle-group behavior).
6. **Reuse** — `ExerciseSwapPicker` and `ExerciseAddPicker` from `file:src/components/generator/`; extend or wrap only if necessary for layout/accessibility on the home screen.
7. **Empty day** — If all exercises are removed (session or permanent), **Start Workout** stays disabled with a short explanation and a path to add an exercise or open Builder (mirror empty-state patterns already in `WorkoutPage` for active session).

**Out of scope:**

- Reordering exercises pre-session (Builder DnD remains the place for template order).
- Editing sets, reps, or weight before start (active session only).
- Drag-and-drop on the home screen.
- **Quick Workout** sheet flow in v1 (can be a follow-up if the same primitives apply trivially).
- Changing the Workout Overview epic’s scope beyond this pre-session feature (no carousel/cycle redesign).

---

## Success Criteria

- **Numeric:** After one permanent add/delete/swap, `["workout-exercises", dayId]` reflects the change without a full page reload; session-only changes never write to `workout_exercises`.
- **Qualitative:** User always understands whether the program template changed or only the next run (dialog + consistent labels).
- **Qualitative:** Swap candidates match **same muscle group** as the current row (`ExerciseSwapPicker` behavior), excluding exercises already on the day.
- **Qualitative:** Starting the workout uses the **merged** list (session overrides + server data) so set rows and PR detection align with visible exercises.

---

## Working assumptions (for Tech Plan; validate with PM)

1. **Override lifecycle** — Clearing overrides when switching carousel days avoids stale edits when comparing days; freezing merged list on **Start** matches user expectation for “this run only.”
2. **Permanent swap** — Update row identity + snapshots; keep prescription fields unchanged.
3. **Conflict with older doc** — `docs/Epic_Brief_—_Workout_Overview_Session_Cards.md` “Out of scope” swap-on-card line targeted a different phase; this epic is the intentional follow-up.

When ready, say **create tech plan** to continue.
