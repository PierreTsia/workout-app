# Epic Brief — Builder-Library Unification

## Summary

This epic transforms the Workout Builder from a standalone top-level destination into a contextual editing action scoped to a specific program. The Library becomes the single hub for program management: browsing, creating, editing, activating, and archiving. Users can now edit any saved program (not just the active one) and create custom programs from scratch — all through the Library. The Builder is removed from the side drawer and is always entered with a `programId` via route param.

---

## Context & Problem

**Who is affected:** All post-onboarding users who want to customize their workout programs or create new ones from scratch.

**Current state:**
- The Builder (`/builder`) is hardwired to the active program via `activeProgramIdAtom` — there is no way to select which program to edit
- The Library (`/library`) displays programs (My Workouts tab) but offers no "Edit" action — program cards are read-only (view details, activate, archive)
- There is no way to create a custom program from scratch outside of onboarding's "self-directed" path
- Builder and Library are separate top-level entries in the side drawer, creating a fragmented mental model: programs *live* in the Library but can only be *edited* in a disconnected section
- Editing an inactive program requires activating it first, disrupting the user's current workout program

**Pain points:**

| Pain | Impact |
|---|---|
| Builder locked to active program | Users can't customize inactive or saved programs without activating them first |
| No "Edit" action in Library | Programs are display-only — the Builder always opens the active program, so users can't target a specific inactive program for editing |
| No "Create from scratch" flow | Power users who want full manual control must go through onboarding again or have no path at all |
| Builder and Library as separate nav items | Fragmented UX — users must maintain a mental map of two disconnected sections that operate on the same data |
| Self-directed path buried in onboarding | The only "create empty program" flow is in onboarding, inaccessible to existing users |

---

## Goals

| Goal | Measure |
|---|---|
| Edit any program | Users can open the Builder for any non-archived program from the Library in 1 tap |
| Create from scratch | Users can create and start building a custom program from the Library in <= 2 interactions (CTA → name → Builder) |
| Unified navigation | Builder is no longer a top-level nav item — Library is the single entry point for program management |
| Contextual Builder | Builder always knows which program it's editing (via URL param), displays program name in header |
| Zero regression | Active program tracking, session tracking, RLS policies, and template flows work identically before and after |

---

## Scope

**In scope:**

1. **Route change: `/builder` → `/builder/:programId`** — Builder reads `programId` from URL params instead of `activeProgramIdAtom`. Five hooks need to accept an explicit `programId` parameter: `useWorkoutDays` (`file:src/hooks/useWorkoutDays.ts`), and `useCreateDay`, `useUpdateDay`, `useDeleteDay`, `useReorderDays` (`file:src/hooks/useBuilderMutations.ts`). Exercise-level hooks (`useAddExerciseToDay`, `useUpdateExercise`, `useDeleteExercise`, `useReorderExercises`) are unaffected — they scope by `dayId`, not `programId`. **Shared hook strategy:** `useWorkoutDays` is called by both the Builder and WorkoutPage. After the refactor, it accepts an explicit `programId` parameter. The Builder passes the URL param; WorkoutPage reads `activeProgramIdAtom` and passes it explicitly. The hook no longer reads the atom internally. `activeProgramIdAtom` remains in use for Workout page and session tracking — it is not removed.

2. **"Edit" action on ProgramCard** — each non-archived program card in My Workouts (`file:src/components/library/ProgramCard.tsx`) gains an "Edit" button that navigates to `/builder/:programId`. Archived programs cannot be edited (Edit button disabled or hidden; user must un-archive first).

3. **"Edit" action in ProgramDetailSheet** — the existing detail bottom sheet (`file:src/components/library/ProgramDetailSheet.tsx`) gains an "Edit" button alongside existing actions, navigating to `/builder/:programId`. Disabled for archived programs.

4. **"Create Program" CTA in My Workouts** — a button in the My Workouts tab (`file:src/components/library/MyWorkoutsTab.tsx`) that opens a lightweight dialog (name field only, default: "My Program"). On confirm: creates an empty row in the `programs` table (no days, no exercises, `is_active = false`, `template_id = null`) and navigates to `/builder/:newProgramId`.

5. **Builder header with program context** — the Builder page (`file:src/pages/BuilderPage.tsx`) displays the program name in the header. Tapping the name opens an inline rename field. When editing an inactive program, an "Activate" action is available in the header — reuses both `useActivateProgram` and `ActivateConfirmDialog` (`file:src/components/library/ActivateConfirmDialog.tsx`) from the Library epic, including the in-flight session guard. Back button navigates to the origin page (Library, Workout page, or `/library` as fallback — using origin-aware navigation).

6. **Rename program from Builder** — users can tap the program name in the Builder header to rename it inline. Updates the `programs.name` column. Propagates to My Workouts list on next visit.

7. **Origin-aware back navigation** — the Builder tracks where the user came from (via React Router `state`). Back button returns to: Library (if entered from Library), Workout page (if entered from WorkoutPage empty state), or `/library` (fallback — the natural home for program management). Route state persists across in-tab refreshes in React Router v6+ but is lost on tab close/reopen; `/library` fallback handles that gracefully.

8. **Remove Builder from side drawer** — the "Workout Builder" link in `file:src/components/SideDrawer.tsx` is removed. The side drawer retains: History, Library, Admin, About.

9. **Update existing Builder entry points** — the "Open Builder" and "Add exercises" links on WorkoutPage (`file:src/pages/WorkoutPage.tsx`, lines 283 and 324) are updated to navigate to `/builder/${activeProgramId}`. WorkoutPage does not currently import `activeProgramIdAtom` — it needs to be added. All links pass `{ state: { from: "/" } }` for origin-aware back navigation.

10. **Update onboarding self-directed path** — the onboarding wizard's self-directed outcome (`file:src/pages/OnboardingPage.tsx`) currently navigates to `/builder`. Updated to navigate to `/builder/:programId` using the newly created program's ID.

11. **Invalid programId handling** — if `/builder/:programId` receives a non-existent or unauthorized program ID, the Builder shows an error state and offers navigation back to Library. No silent failures.

12. **Empty Builder UX for "Create from scratch"** — when a user creates an empty program and enters the Builder, `DayList` renders with 0 days. Verify that the empty state has clear affordance ("Add your first day" CTA). If the current `DayList` empty state is insufficient, add one. This is the first impression of the headline "Create from scratch" feature — it must not be a blank screen.

13. **E2E test updates** — `e2e/builder-crud.spec.ts` (lines 32, 170) and `e2e/feedback.spec.ts` (line 44) reference `page.goto("/builder")`. These must be updated to navigate to `/builder/:programId` with a valid program ID. Setup fixtures may need a program creation step.

14. **PRD route table update** — `docs/PRD.md` lists `/builder` in the app routes table (line 93). Update to `/builder/:programId` to keep the PRD accurate.

15. **i18n** — all new strings (Create Program dialog, Builder header, Edit/Rename labels, error states) added to FR/EN in the `library` and `builder` namespaces.

**Out of scope:**

- Quick Workout (#55 — separate epic)
- Step-by-step program creation wizard (simple name prompt is sufficient)
- Program sharing / social features
- Template creation by users
- New "Edit Program" shortcut on the Workout page (Library is the entry point; existing empty-state links are updated but no new shortcut is added)
- Changes to RLS policies (issue asks to verify — verification only, no changes expected)

---

## Success Criteria

- **Numeric:** Users can go from Library → editing any program in 1 tap (Edit button on card or detail sheet)
- **Numeric:** Users can create a custom program and land in the Builder in <= 2 interactions (CTA → name → Builder)
- **Numeric:** 0 references to the old `/builder` route remain in app code or E2E tests (all updated to `/builder/:programId`)
- **Qualitative:** Builder header clearly shows which program is being edited (name, tappable to rename)
- **Qualitative:** Inactive programs show an "Activate" action in the Builder header
- **Qualitative:** Archived programs cannot be edited — Edit action is disabled/hidden with clear visual indication
- **Qualitative:** End-to-end creation flow works: user creates a program from Library, adds a day in the Builder, adds exercises to the day, configures sets/reps — all without errors or blank screens
- **Qualitative:** Existing flows (onboarding self-directed, WorkoutPage empty states) continue to work with the new route structure
- **Qualitative:** Navigating to an invalid `/builder/:programId` shows a clear error, not a blank/broken page
- **Qualitative:** Back button in Builder returns to the origin page, not a hardcoded destination

---

## Dependencies

- **Workout Library Dashboard (shipped):** This epic builds on the Library infrastructure — `ProgramCard`, `ProgramDetailSheet`, `MyWorkoutsTab`, `useActivateProgram`, `useArchiveProgram`, and the three-tab layout.
- **Onboarding & Program Generation (shipped):** The `programs` table, `useGenerateProgram` hook, and onboarding wizard's self-directed path.
- **Builder (shipped):** All builder hooks (`useWorkoutDays`, `useBuilderMutations`) and components (`DayList`, `DayEditor`, `ExerciseDetailEditor`, etc.).

---

## Trade-offs & Known Limitations

- **`activeProgramIdAtom` not removed:** The atom stays because the Workout page and session tracking need it. The Builder simply stops reading from it, preferring the URL param. Two sources of "current program" exist in the app (atom for workout, URL for builder) — this is intentional and each serves a distinct purpose.
- **No "Edit Program" shortcut on Workout page:** Keeps the Workout page focused on the session experience. Users who want to edit go through Library. If this proves too much friction, a shortcut can be added later without architectural changes.
- **Name-only creation dialog:** We're not collecting number of days, goals, or other metadata at creation time. This keeps the flow minimal but means newly created programs in My Workouts will appear sparse until the user builds them out in the Builder.
- **Origin-aware navigation adds minor complexity:** Tracking the origin page via React Router `state` is simple but state is lost if the user closes and reopens the tab. Fallback to `/library` is acceptable since it's the program management hub. Query params would survive but pollute the URL; not worth it for this use case.
- **Shared `useWorkoutDays` hook refactored:** Both Builder and WorkoutPage call this hook. After the refactor, all callers pass `programId` explicitly. This breaks the "just call the hook" convenience for WorkoutPage (it must now read `activeProgramIdAtom` and pass it), but eliminates the atom coupling inside the hook — cleaner, more testable, and unambiguous about which program is being queried.
