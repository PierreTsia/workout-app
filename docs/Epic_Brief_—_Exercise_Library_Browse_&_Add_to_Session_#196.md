# Epic Brief — Exercise Library Browse & Add to Session (#196)

## Summary

This epic gives users a **first-class path to explore the full exercise catalog** (search, filters, detail) **without opening the program builder**, and lets them **add an exercise to a training context** (“session”) from the exercise detail screen—with clear success and error feedback. **Information architecture:** the existing **Library** entry in the shell becomes a **two-destination hub**: **Library > Exercises** (browse + detail + add) and **Library > Programs** (today’s saved workouts and user programs). The backend already exposes **full-library search** via `search_exercises` and the app already has **list/detail building blocks** in builder and swap flows; this epic **surfaces and wires them for discovery**. **Scope nuance:** “without the builder” means **no `BuilderPage` / builder chrome** as the entry path; **adding** an exercise may still **write** to `workout_exercises` (template day)—that is **not** “no program mutation,” it is **discovery-first UX**.

---

## Context & Problem

**Who is affected:** Anyone who wants to **browse** or **learn about** exercises, or **compose a workout**, without being forced through **program construction** (`file:src/pages/BuilderPage.tsx`) or **swap-only** entry points.

**Current state:**

- **Library** (`file:src/pages/LibraryPage.tsx`, route `file:src/router/index.tsx` → `/library`) is **program- and saved-workout–centric**: `SavedWorkoutsSection` and `MyWorkoutsTab` (`file:src/components/library/MyWorkoutsTab.tsx`). There is **no** dedicated **exercise** browse or detail route for end users.
- **Full-database exercise search** exists for **builder/swap** contexts: `search_exercises` is consumed by `file:src/hooks/useExerciseLibraryPaginated.ts` and UI such as `file:src/components/builder/ExerciseLibraryPicker.tsx` and swap flows (`file:src/components/workout/SwapExerciseSheet.tsx`). Browsing is **not** positioned as a standalone product surface.
- **Exercise detail content** is loaded via `file:src/hooks/useExerciseFromLibrary.ts` (wrapper over `useExerciseById`) and shown in panels such as `file:src/components/exercise/ExerciseInstructionsPanel.tsx` and workout/builder surfaces—**not** as a shareable **detail page** reachable from a global library.
- **Adding an exercise to “a session”** today is natural in **WorkoutPage** / **builder** (e.g. `useAddExerciseToDay` in `file:src/hooks/useBuilderMutations.ts`, pre-session scope handling in `file:src/pages/WorkoutPage.tsx`). There is **no** flow that starts from **catalog discovery** and ends with **attach to a day or active workout** without detouring through the builder.

**Relationship to prior work:** The **Workout Library Dashboard** epic (`file:docs/done/Epic_Brief_—_Workout_Library_Dashboard.md`) introduced `/library` and described a richer tabbed layout (including a **template catalog**). **What actually ships today:** `file:src/pages/LibraryPage.tsx` is **saved workouts** (`SavedWorkoutsSection`) **plus** **user programs** (`MyWorkoutsTab`)—**no** template grid on this page. **`ProgramsTab`** (`file:src/components/library/ProgramsTab.tsx`) is used only in **create-program** (`file:src/components/create-program/TemplateChoiceStep.tsx`). This #196 epic **adds** **Library > Exercises** and splits **Library > Programs** as the **home for current `LibraryPage` content**; it **does not** by itself promise to move **template browsing** onto `/library/programs` unless the Tech Plan explicitly expands scope (otherwise templates stay in create-program).

**Pain points:**

| Pain | Impact |
|---|---|
| No dedicated **browse-all-exercises** UX | Users cannot explore the ~600-row catalog without a builder/swap context. |
| No **detail URL** from exploration | Deep-linking, sharing, and “open from search” are weaker; content is buried in sheets. |
| **Add to session** only via builder/workout affordances | Discovery → action requires mental remapping (“find it again in the builder”). |

---

## Gap analysis (from issue #196)

**Ambiguities**

- **“Session”** can mean **template day** (`workout_days` + `workout_exercises`), **in-progress workout** on `WorkoutPage`, or a **quick/draft** day (`program_id` null, `saved_at`, etc.). The issue asks for **existing selection or quick create**—exact rules belong in the Tech Plan but must stay **consistent with guards** (e.g. active session / program switch) already documented elsewhere.

**Missing in the issue (filled by this brief)**

- **Navigation:** resolved toward **Library > Exercises** and **Library > Programs** (see Scope).
- **Reuse:** explicit references to existing hooks and RPCs (see Scope).

**Implicit assumptions**

- **Search/filter** can reuse **`search_exercises`** and the same filter dimensions already supported by `useExerciseLibraryPaginated` (text, muscle, equipment, difficulty)—no need to invent a parallel catalog API for v1.
- **i18n:** new strings for browse, detail, and add-to-session in **FR/EN** (`file:src/lib/i18n.ts`, `library` / `common` namespaces as appropriate).

**Contradictions**

- None identified vs `file:docs/PRD.md`; note the PRD **route table** may lag the app—**source of truth** is `file:src/router/index.tsx`.

---

## Goals

| Goal | Measure |
|---|---|
| **Discoverable exercise library** | User reaches **Exercises** from the shell **without** opening the builder. |
| **Full-catalog coverage** | Search/browse uses the **entire** exercise table semantics already implemented for `search_exercises` (not limited to exercises already in the user’s program). |
| **Detail page** | From browse results, user opens a **detail** view with description, media, and metadata consistent with existing content model. |
| **Add to session** | From detail, user runs **Add to session** with **success/error** feedback; implementation may offer **pick program/day** and/or **quick create** per Tech Plan. |
| **Library IA** | **Library** exposes **Exercises** and **Programs** as two clear destinations (drawer + routes). |
| **Reuse** | Prefer **composition** of `useExerciseLibraryPaginated`, `useExerciseFromLibrary`, and existing presentation patterns over duplicate fetch logic. |

---

## Scope

**In scope**

1. **Routes (nested under authenticated `AppShell`)**  
   - **`/library/exercises`** — browse/search/filter list (infinite scroll or equivalent UX aligned with `useExerciseLibraryPaginated`).  
   - **`/library/programs`** — **current** Library content now on `LibraryPage` (saved workouts + my programs), possibly by **moving** or **wrapping** existing sections so behavior stays the same.  
   - **`/library`** — **redirect** to a **default** child (recommend **`/library/programs`** so existing bookmarks to “Library” keep a program-centric landing; Tech Plan may override if analytics say otherwise).

2. **Exercise detail route** — e.g. `/library/exercises/:exerciseId` (exact path in Tech Plan), showing rich content (instructions, media, metadata) reusing `useExerciseFromLibrary` and patterns from `ExerciseInstructionsPanel` / builder detail where appropriate.

3. **Shell navigation** — **`file:src/components/SideDrawer.tsx`**: replace the single `Link` to `/library` with a **Library** subsection (e.g. `Collapsible`, same family as admin) with **Exercises** and **Programs** links to the routes above. **i18n** for new labels.

4. **Add to session (primary epic differentiator)** — CTA on exercise detail:  
   - **Minimum:** user can attach the exercise to a **chosen program day** (template) using existing insert patterns (`useAddExerciseToDay` / batch helpers in `file:src/hooks/useBuilderMutations.ts`).  
   - **Stretch / alternative** aligned with issue text: **quick-create** a day or use **quick workout** flows where they already exist (`file:src/hooks/useCreateQuickWorkout.ts`)—**Tech Plan** chooses one coherent default path plus edge cases (no program, session active, etc.).

5. **Feedback** — toasts or inline states for **success** and **failure** on add (permissions, network, validation).

6. **Tests** — at least **smoke-level** coverage for new routes or critical interactions (Vitest/Playwright per existing conventions).

**Out of scope**

- **Changing** `search_exercises` semantics or re-seeding the exercise catalog (unless a bug blocks browse).  
- **Admin** exercise editing (`/admin/exercises`) — unchanged.  
- **Social sharing** of exercise URLs beyond normal routing (no new backend).  
- **GymLogic Coach** (`file:docs/Epic_Brief_—_GymLogic_Coach_#191.md`) — no dependency; only avoid conflicting routes/naming.

---

## Success Criteria

- **Qualitative:** User can open **Library > Exercises** from the menu **without** navigating to the builder.  
- **Qualitative:** Browse/search returns exercises from the **full** catalog (same contract as `useExerciseLibraryPaginated` / `search_exercises`).  
- **Qualitative:** User can open an exercise **detail** from browse results.  
- **Qualitative:** **Add to session** from detail completes with **visible success** or **actionable error**.  
- **Qualitative:** **Library > Programs** preserves the current Library value (saved workouts + user programs) under the new IA.  
- **Numeric (acceptance checklist aligned with #196):** all items in the GitHub issue acceptance list can be checked after implementation review.

---

## Assumptions for Tech Plan (validate during design)

1. **Default redirect** from `/library` → `/library/programs` preserves existing mental model for “Library = my stuff”; change only if product prefers Exercises-first.  
2. **“Session”** is implemented as **attach to a workout day** (template) first; **in-progress session** attach is a **follow-up** if it multiplies edge cases—unless product insists on parity in v1.  
3. **Drawer** uses **two links** under Library (not a single combined page without URLs)—deep links matter for PWA/bookmarks.

When ready, say **create tech plan** to continue with architecture, exact routes, and mutation matrix.
