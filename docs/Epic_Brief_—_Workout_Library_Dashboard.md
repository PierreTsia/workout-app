# Epic Brief — Workout Library Dashboard

## Summary

This epic adds a dedicated Library screen (`/library`) where users can browse the full program template catalog, save templates as pre-generated inactive programs, and activate or switch between programs — all from a single, self-service interface. The screen features three tabs: **My Workouts** (the user's active and saved programs), **Programs** (the filterable template catalog), and **Quick Workout** (a disabled placeholder for issue #55's on-the-fly generator). It replaces the existing `/change-program` wizard with a richer, browse-first experience. Equipment-based filtering is derived automatically from template exercise data rather than manually maintained metadata.

---

## Context & Problem

**Who is affected:** All post-onboarding users who want to discover, compare, or switch between workout programs.

**Current state:**
- Program discovery only happens during onboarding or via the `/change-program` flow (`file:src/pages/ChangeProgramPage.tsx`) — a linear wizard that shows a ranked recommendation, not the full catalog
- No way to browse all available templates side-by-side or compare them before committing
- No concept of "saving" a template for later — users must generate and activate a program immediately or lose track of it
- Switching programs requires navigating a multi-step wizard (path choice → recommendation → summary → confirm) every time
- Inactive programs are invisible — once deactivated, they disappear from the UI entirely
- Templates have no equipment metadata — `program_templates` lacks an equipment field, so users can't filter by home/gym/minimal

**Pain points:**

| Pain | Impact |
|---|---|
| No browsable template catalog | Users can't compare programs before committing to one |
| No "save for later" | Users must either start a program immediately or lose track of interesting templates |
| Linear change-program flow | Over-engineered for users who already know what they want |
| Invisible program history | Users who want to return to a previous program can't find it |
| No equipment filter on templates | Users with home/minimal setups can't quickly find compatible programs |

---

## Goals

| Goal | Measure |
|---|---|
| Template discoverability | 100% of templates browsable and filterable by goal, experience, and equipment |
| Frictionless program switching | Users can go from Library → running a new program in <= 3 interactions (filter → card → confirm) |
| Save-for-later workflow | Users can pre-generate inactive programs from templates without disrupting their active program |
| Single entry point | Library replaces `/change-program` as the only way to browse templates and manage programs |
| Extensible for #55 | Tab structure and card components accommodate the future on-the-fly workout generator without rework |

---

## Scope

**In scope:**

1. **New route `/library`** — sits inside `OnboardingGuard` + `AppShell` (same position as current `/change-program`). Post-onboarding only. Three-tab layout:
   - **My Workouts** — all non-archived user `programs` rows. Active program highlighted at top, inactive programs below. Each program card shows a "Generated on [date]" badge so users can tell at a glance whether a saved program reflects their current profile or is stale. Actions: activate (with confirmation dialog — blocked while a workout session is in progress), archive (soft-hide, reversible). An optional "Archived" collapsed section at the bottom allows un-archiving.
   - **Programs** — all `program_templates` as cards. Filter bar: goal (strength / hypertrophy / endurance / general fitness), experience (beginner / intermediate / advanced), equipment (gym / home / minimal). Actions per card: "Save" (pre-generate inactive) and "Start" (pre-generate + activate). Cards for already-saved templates show "Already saved" state instead of a Save button (duplicate prevention via `template_id` check).
   - **Quick Workout** — visible but disabled placeholder tab with "Coming Soon" badge. Reserved for issue #55 (on-the-fly workout generator). No functionality — signals the feature is coming and locks in the tab structure.

2. **Template detail bottom sheet** — tapping a template card opens a bottom sheet showing: full description, day breakdown (day labels + muscle focus), exercise list per day. Save and Start actions live inside the bottom sheet. Reuses patterns from existing `file:src/components/onboarding/ProgramSummaryStep.tsx`.

3. **Template card component** — generic, reusable card with: name, description, day range (e.g. "3–6 days/week"), primary goal badge, experience tags, equipment context badges, and action slots. Designed for reuse with #55's workout templates.

4. **"Save" = pre-generate inactive program** — runs the generation pipeline (`file:src/hooks/useGenerateProgram.ts`) with `is_active = false`, without deactivating the current program. Requires modifying `useGenerateProgram` to accept an `activate` boolean parameter (current behavior always deactivates the active program first). The user's profile (`file:src/types/onboarding.ts` → `UserProfile`) is fetched from `user_profiles` to drive equipment swaps and experience adaptation. No new tables — reuses the existing `programs` table.

5. **"Activate" from My Workouts** — new `useActivateProgram` hook. Deactivates current program (`is_active = false`), sets target program `is_active = true`, updates atoms (`activeProgramIdAtom`, `hasProgramAtom`), invalidates React Query caches (`workout-days`, `active-program`). Confirmation dialog warns that the current program will be deactivated. **In-flight session guard:** if a workout session is currently active (`sessionAtom.isActive === true`), the Activate button is disabled with a message ("Finish your current workout first"). This prevents corrupting in-progress `set_logs` by switching the active program mid-session.

6. **"Archive" from My Workouts (replaces delete)** — instead of hard-deleting programs (which risks cascading data loss and requires session-count guards), programs are soft-archived via an `archived_at timestamptz` column on the `programs` table. Archived programs disappear from the main My Workouts list but remain in the database with all `workout_days`, `workout_exercises`, and linked `sessions` intact. An optional collapsed "Archived" section at the bottom of My Workouts allows users to view and un-archive programs. No cascade concerns, no data loss, fully reversible.

7. **Duplicate save prevention** — before saving, check if the user already has a `programs` row with the same `template_id`. If so, the template card shows "Already saved" state and the Save button is replaced with a link to the existing program in My Workouts.

8. **Equipment filtering (derived, not static)** — instead of a manually maintained column on `program_templates`, equipment compatibility is derived from the template's exercises at query time. A template supports a given equipment context (home / minimal) if every exercise in the template either requires no gym equipment or has an alternative in `exercise_alternatives` for that context. This is computed via a Postgres view or in the `useTemplates` hook — the Tech Plan will decide the exact mechanism. All templates inherently support "gym" (their default authoring context). This approach is zero-maintenance: adding templates, exercises, or alternatives automatically updates the filter results.

9. **Side drawer update** — replace "Change Program" link (`file:src/components/SideDrawer.tsx`) with "Library" link pointing to `/library`.

10. **Remove `/change-program`** — delete `file:src/pages/ChangeProgramPage.tsx` and its route from `file:src/router/index.tsx`. The Library fully replaces this flow.

11. **i18n** — all new strings in FR/EN. New `library` namespace or extend existing namespaces (`common`, `onboarding`).

**Out of scope:**

- On-the-fly workout generator (issue #55 — Quick Workout tab is placeholder only)
- Template editing or custom template creation (admin concern, not user-facing)
- Onboarding flow changes (`/onboarding` remains untouched)
- Social features, template sharing, or community ratings
- Template text search (only 5 templates; filters suffice)
- Regenerating saved programs when user profile changes (accepted trade-off — programs bake in the profile at save time; users can archive and re-save if needed)
- Hard-deleting programs (archive-only approach — no data loss risk)

---

## Success Criteria

- **Numeric:** 100% of program templates are browsable and filterable in the Programs tab
- **Numeric:** Users can go from Library → running a new program in <= 3 interactions (filter → card → confirm start)
- **Numeric:** Equipment filter correctly narrows templates (e.g. selecting "home" hides gym-only templates)
- **Qualitative:** Saved programs persist across sessions and appear in My Workouts with clear active/inactive visual distinction
- **Qualitative:** Starting a program from Library produces the same workout structure as the old change-program flow (same generation logic)
- **Qualitative:** The active program is always clearly distinguished in My Workouts (highlighted card, "Active" badge)
- **Qualitative:** Each program card in My Workouts shows a "Generated on [date]" badge so users can assess freshness
- **Qualitative:** Programs are archived (not deleted) — data fully preserved, action reversible
- **Qualitative:** Program activation is blocked while a workout session is in progress
- **Qualitative:** The Quick Workout placeholder tab communicates "coming soon" without confusing users

---

## Dependencies

- **Onboarding & Program Generation (shipped):** This epic builds on the `programs`, `program_templates`, `template_days`, `template_exercises`, and `exercise_alternatives` tables, the `useGenerateProgram` hook, and the `useTemplates` hook — all shipped as part of the Onboarding epic.
- **User Profiles (shipped):** The generation pipeline requires a `UserProfile` row to drive equipment swaps and experience adaptation. Created during onboarding.

---

## Trade-offs & Known Limitations

- **Stale saved programs:** Pre-generated programs bake in the user's equipment and experience at save time. If the user later updates their profile (e.g. switches from "home" to "gym"), saved programs retain the old configuration. Mitigation: each program card shows a "Generated on [date]" badge so users can assess freshness at a glance. Users can archive the stale program and re-save from the template. A "Regenerate" action is a natural follow-up but deferred.
- **Derived equipment filtering adds query complexity:** Computing equipment compatibility from template exercises + `exercise_alternatives` requires joins at query time rather than a simple column read. With 5 templates and ~30-50 template exercises, the performance impact is negligible. If the catalog scales significantly, a materialized view or cached computation can be added.
- **My Workouts query performance:** The My Workouts tab needs program metadata (name, template origin, creation date) for potentially many programs. This should be a single server-side query — avoid N+1 client-side fetching. The Tech Plan should define a `useUserPrograms` hook that returns all non-archived programs in one call.
- **No undo on activate:** Activating a program deactivates the current one. There's no "undo" — the user must manually re-activate the previous program from My Workouts. The confirmation dialog and in-flight session guard mitigate accidental switches.

---

## Open Questions

- Whether the My Workouts tab should show the program's source template name alongside the program name (useful when multiple programs come from the same template at different times)
- Whether the "Quick Workout" placeholder should include a brief description of what's coming or just a badge
- Exact definition of "gym equipment" for the derived equipment filter — should bodyweight exercises be considered compatible with all contexts? (likely yes, but needs explicit rule in the Tech Plan)
