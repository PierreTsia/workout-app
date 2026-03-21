# Epic Brief — Pre-session Exercise Editing

## Summary

Users can adjust the exercise list on the main workout screen **before** tapping **Start Workout**: swap an exercise for another from the library, remove one, or add one. Every such action asks whether the change applies **only to the upcoming session** (local override, no DB write) or **permanently** to **this user’s program** — i.e. their own `workout_exercises` rows for that day (same data the Builder edits), with query invalidation. **Permanent never means** mutating a global, read-only program blueprint shared across users; only the signed-in user’s program instance is updated.

**Meaning of “Apply permanently” (must be explicit in UI copy and Tech Plan):** it changes the **definition of that workout day** for **all future sessions** on that day (every future rotation) — the same semantic as editing that day in the Builder. It is **not** a one-off “next occurrence only” fork. Finished **sessions** and **set logs** are **not** rewritten; history stays consistent with what was logged at the time. During an **active training cycle** (see cycle model / #81), permanent edits can make **upcoming** runs of that day differ from what earlier cards or mental models implied; the Tech Plan must spell out edge cases (e.g. last-session preview vs new template) and avoid implying that past completed work changed.

This closes the gap between “I see my day” (post–[Workout Overview / session cards](Epic_Brief_—_Workout_Overview_Session_Cards.md)) and “I’m ready to train” without opening the Builder first.

GitHub: [issue #83](https://github.com/PierreTsia/workout-app/issues/83). Parent UI context: PR #82 / `file:src/pages/WorkoutPage.tsx` pre-session branch and `file:src/components/workout/ExerciseListPreview.tsx`.

---

## Context & Problem

**Who is affected:** Anyone using a saved program who lands on `/` and reviews the day’s exercises before starting.

**Current state:**

- Pre-session UI shows a read-only list (`ExerciseListPreview` driven by `useWorkoutExercises` + `previewItems` in `file:src/pages/WorkoutPage.tsx`).
- Edits to **the user’s program** (their per-day `workout_exercises`) today go through the Builder (`file:src/hooks/useBuilderMutations.ts`). The exercise **library** (`exercises` catalog) and **canonical / shared program definitions** (read-only relative to end users — not their personal `workout_exercises` rows) are never mutated by this feature.
- The generator preview flow already has swap/add patterns (`file:src/components/generator/PreviewStep.tsx`, `ExerciseSwapPicker`, `ExerciseAddPicker`) but they are not wired to the workout home screen or to Supabase.
- `file:src/hooks/useExercisesForGenerator.ts` filters by equipment and muscle groups — it is **not** suitable as the universal picker pool; a dedicated full-library query (e.g. `useExerciseLibrary`) is required for pickers on this screen.
- The Workout Overview epic once listed “exercise swap from the overview card” as out of scope during **active session** focus; **issue #83 explicitly adds pre-session editing**. This epic supersedes that omission for the pre-start path only.
- **Training cycles** (e.g. [issue #81](https://github.com/PierreTsia/workout-app/issues/81)) tie sessions to rotations; **permanent** day edits do not mutate historical sessions but can change what the user sees for **future** starts of that day mid-cycle — product and Tech Plan must align so this is understandable and safe.

**Pain points:**

| Pain | Impact |
|---|---|
| Wrong machine or mood — user wants a different exercise before starting | Must leave flow, edit Builder, return — high friction |
| One-off substitution (travel, injury) | No way to tweak a single run without mutating **their** saved day (or using session-only once this ships) |
| No parity with generator “preview before start” | Generator users can swap/add; program users cannot |

---

## Goals

| Goal | Measure |
|---|---|
| Pre-session edit parity | From `/`, on a day **not** completed in the current cycle, user can swap, delete, or add at least one exercise and start with the updated list without visiting Builder (for session scope) or with **their program’s day** updated in DB (for permanent scope) |
| Clear scope choice | 100% of destructive or program-mutating actions pass through an explicit **Just this session** vs **Apply permanently** decision |
| No regression to active session | In-session `ExerciseStrip` / `ExerciseDetail` / set logging behavior unchanged for the same logical exercise list |
| Library coverage for pickers | Pickers receive a full exercise list (same source of truth as the library), with acceptable load time on warm cache (target: under ~1s after first fetch, per PRD PWA expectations) |

---

## Scope

**In scope:**

1. **UI entry points** — On the pre-session view for a **program day** (not quick workout in v1), when the day is **not** already completed in the current cycle, each row in the exercise preview (or equivalent affordances) supports actions: **Swap**, **Delete**, **Add** (add inserts at end or opens add picker; exact control layout left to Tech Plan). **Completed days:** same read-only preview as today — **no** swap, delete, or add (user must **reset day** if they need to change the template from this screen; Builder remains available regardless).
2. **`ExerciseEditScopeDialog`** — For **swap/add**, after the user picks a library exercise, show **Just this session** vs **Apply permanently** before applying. For **delete**, the same scope choice is required **before** the row is removed (exact order vs an extra “Are you sure?” step is a Tech Plan / UX detail — must be consistent across actions). Copy i18n-ready. Label **Apply permanently** so it is clear this updates **the day’s definition for all future rotations** (their saved `workout_exercises` for that day), **not** past session history and **not** any shared catalog.
3. **Session-only path** — Local state on `WorkoutPage` (e.g. `exerciseOverrides`) merges with `useWorkoutExercises` data to produce the list used for preview and for initializing the active session. No Supabase mutation. Overrides **clear** when: the user **changes the selected program day** (carousel); after **Start Workout** the in-session list is the frozen result of that merge (override state may reset once active); when the user completes the session and hits the flow that resets session atom (`handleNewSession` / equivalent). **Page reload** clears session-only overrides (acceptable).
4. **Permanent path** — Mutations target only rows the user owns (RLS-scoped `workout_exercises` for their `workout_day_id`), identical in spirit to the Builder: **the template for that day going forward**, including all future cycles. **Add:** `useAddExerciseToDay` with correct `sort_order`. **Delete:** `useDeleteExercise`. **Swap:** not covered by existing mutations — update that row’s exercise identity + snapshot fields; **preserve** sets, reps, rest, and `sort_order`. **Weight after swap:** never copy the **replaced** exercise’s load. For the **new** `exercise_id`, **look up the user’s own session history** (e.g. last logged weights/reps for that exercise across past sessions); if found, **reuse those values** in the template (or as the initial session prescription — Tech Plan picks the single source of truth). If **no** history exists for that exercise, **default template weight to `0`** (existing `file:src/hooks/useLastWeights.ts`–style data is the likely implementation hook). **Do not** write to shared/read-only program templates or to library `exercises` definitions. On success, invalidate the day’s exercises query and **clear session-only overrides for that day** so local state cannot fight the server.
5. **`useExerciseLibrary`** — `useQuery` loading all exercises (e.g. `from("exercises").select("*").order(...)`) for picker `pool` props; no equipment/muscle filter at the hook level (pickers may still filter — `ExerciseSwapPicker` keeps same-muscle-group behavior).
6. **Reuse** — `ExerciseSwapPicker` and `ExerciseAddPicker` from `file:src/components/generator/`; extend or wrap only if necessary for layout/accessibility on the home screen.
7. **Start guard (non-empty session)** — **Start Workout** is disabled unless **(a)** there is at least one exercise and **(b)** every exercise has a **valid prescription for starting** — at minimum **≥ 1 set** per exercise (`sets >= 1` or equivalent). An empty list is insufficient: a single exercise with **0 sets** (template bug, Builder edge case, or bad data) must also block start, with messaging, to avoid empty set tables, broken volume/timer logic, and dashboard glitches. Tech Plan: centralize validation (and optional `validateAndRepair` if the product wants auto-fix) in one place used by the Start CTA.
8. **Swap and weight (session-only too)** — For **session-only** swaps, the merged row must **not** reuse the replaced exercise’s weight. Apply the **same rule as permanent:** resolve load for the **new** `exercise_id` from **the user’s session history** when available, otherwise **0** (then existing session init logic can still hydrate set rows from history on start, if applicable).

**Out of scope:**

- Reordering exercises pre-session (Builder DnD remains the place for order on the user’s day).
- Editing sets, reps, or weight before start (active session only).
- Drag-and-drop on the home screen.
- **Quick Workout** sheet flow in v1 (can be a follow-up if the same primitives apply trivially).
- Changing the Workout Overview epic’s scope beyond this pre-session feature (no carousel/cycle redesign).

---

## Success Criteria

- **Numeric:** After one permanent add/delete/swap, `["workout-exercises", dayId]` reflects the change without a full page reload; session-only changes never write to `workout_exercises`.
- **Qualitative:** User always understands whether **their saved program (that day)** changed for the future or only the next run (dialog + consistent labels); no implication that a global template was edited.
- **Qualitative:** Swap candidates match **same muscle group** as the current row (`ExerciseSwapPicker` behavior), excluding exercises already on the day.
- **Qualitative:** Starting the workout uses the **merged** list (session overrides + server data) so set rows and PR detection align with visible exercises.
- **Qualitative:** For a day **completed in the current cycle**, the exercise list stays **read-only** — no edit affordances (consistent with no **Start Workout** on that state).
- **Qualitative:** **Start** cannot be pressed when any visible exercise has **zero sets** (or invalid prescription); user sees why (copy + recovery path).
- **Qualitative:** After a **swap**, the user is never nudged to lift the **previous** exercise’s weight on the **new** movement. For the **new** exercise, prescribed load comes from **that user’s past performance** of the same exercise when history exists, otherwise **0** until they enter it.

---

## Working assumptions (for Tech Plan; validate with PM)

1. **Override lifecycle** — Clearing overrides when switching carousel days avoids stale edits when comparing days; freezing merged list on **Start** matches user expectation for “this run only.” **Discard** session-only overrides when the user returns to pre-session after a finished session (`handleNewSession` / equivalent), consistent with issue #83 (“after the session ends”).
2. **Permanent semantics vs cycle** — **Permanent** = same as Builder: mutate the user’s **day template** used for **all future starts** of that day. Historical **sessions** remain the source of truth for what happened before; no backfill or rewrite. Mid–training-cycle edits may change “what’s on the card” for not-yet-started runs; Tech Plan documents UX (e.g. last-session block vs new template) so users are not told their **past** work changed.
3. **Swap prescription** — On swap (any scope): **keep** sets, reps, rest, sort order; **never** carry over **weight** from the replaced exercise. For the **new** `exercise_id`: **first** try **the user’s session history** for that same exercise (last known loads / reps — align with how `useLastWeights` or set_logs–backed queries already work); **if none**, **default weight to `0`**. Tech Plan defines the exact query and whether template DB row vs in-memory session init is updated first.
4. **Conflict with older doc** — `docs/Epic_Brief_—_Workout_Overview_Session_Cards.md` “Out of scope” swap-on-card line targeted a different phase; this epic is the intentional follow-up.
5. **Permanent vs shared template** — “Apply permanently” updates only the authenticated user’s program data (`workout_exercises` under their days). Canonical or shared program definitions used for seeding or display stay immutable from this flow.
6. **Completed day in current cycle** — **No pre-session editing.** If the day is done for the current cycle (`isDayDoneInCycle` / equivalent), the list is display-only — same rule as hiding **Start Workout**. To change exercises for that day from the home flow, the user **resets the day** first (existing cycle UX); Builder is unchanged.
7. **Offline / failed permanent write** — Permanent actions need network; surface failure and avoid optimistic UI that hides errors. Session-only edits remain meaningful only while the SPA stays loaded (reload clears them — already stated).
8. **Duplicate exercises on the same day** — Match picker rules: **no** duplicate `exercise_id` on the same day unless Product explicitly wants an exception (default: same as `ExerciseAddPicker` / builder behavior).
9. **Accessibility** — Actions must be available from the keyboard / screen readers (not tap-only icon mystery meat); exact pattern (row menu vs buttons) is Tech Plan.
10. **Start validation** — One shared rule (or helper) gates **Start Workout**: non-empty exercise list **and** per-exercise minimum sets, so we never open an active session that cannot render sets/volume/timer correctly.

When ready, say **create tech plan** to continue.
