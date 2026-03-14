# Epic Brief — Onboarding & Program Generation

## Summary

This epic replaces the hardcoded Push/Pull/Legs bootstrap with a guided onboarding wizard that captures a user's training profile, recommends a program template from a curated library, and auto-generates a personalized multi-day workout program. A new `programs` abstraction groups workout days into switchable units. Templates are first-class persistent entities — programs link back to their source template, enabling users to switch programs or reset to defaults later. An exercise swap table handles equipment variants at generation time. Advanced users can skip template selection and build their own program from scratch, while still completing the profile questionnaire. The feature ships incrementally across 3 phases.

---

## Context & Problem

**Who is affected:** Any new user arriving at the app for the first time, and existing users who want to switch to a structured program.

**Current state:**
- When a user has no `workout_days`, `file:src/hooks/useBootstrapProgram.ts` auto-creates a hardcoded Push/Pull/Legs split (Pierre's personal program)
- No questionnaire, no profile capture, no personalization whatsoever
- The workout builder (`file:src/pages/BuilderPage.tsx`) exists with full CRUD but offers no guidance — it's a blank canvas for new users
- No concept of "program templates" or "programs" — every program is built manually or accepted as the default bootstrap
- No user profile data is captured or stored beyond authentication
- `workout_days` are flat user-owned rows with no grouping abstraction — switching programs would orphan session history

**Pain points:**

| Pain | Impact |
|---|---|
| No personalization | Every user gets the same PPL regardless of goals, experience, or equipment |
| Cold-start friction | New users must either accept a generic default or manually build from scratch |
| No program abstraction | Can't switch programs without losing day-history links |
| No template ecosystem | Users cannot browse proven programs |
| No onboarding funnel data | Zero visibility into how new users engage |

---

## Goals

| Goal | Measure |
|---|---|
| Reduce cold-start friction | >= 80% of new users who start onboarding complete it (create a program or choose the self-directed path) |
| Personalized programs | 100% of generated programs respect the user's stated goal, experience, equipment, and frequency |
| Template discoverability | 5 templates available at launch (one per goal), expandable without code changes |
| Program switching | Users can adopt a new template without losing session history |
| Onboarding funnel visibility | Every onboarding step and template selection tracked via analytics events |

---

## Scope

**In scope:**

1. **Programs abstraction** — new `programs` table (`id`, `user_id`, `name`, `template_id` (nullable — null for self-directed programs), `is_active`, `created_at`). `name` is copied from the template at creation time (e.g. "PPL (Push/Pull/Legs)") or defaults to "My Program" for self-directed programs. `workout_days` gains a `program_id` FK. This groups days into switchable programs: deactivate old, create new, history stays linked via `sessions.workout_day_id`. All existing queries on `workout_days` are updated to filter by active program. **This is the highest-risk change** — every hook that reads/writes `workout_days` (`useWorkoutDays`, `useWorkoutExercises`, `useBuilderMutations`, session creation) must be updated to scope through the active program.

2. **User profile model** — new `user_profiles` table:
   - `user_id` (PK, FK to auth.users)
   - `age` (integer, nullable)
   - `weight_kg` (numeric, nullable — always stored in kg; questionnaire input respects the user's unit preference via `weightUnitAtom` and converts to kg on save, consistent with existing app behavior)
   - `goal` (enum: strength / hypertrophy / endurance / general_fitness)
   - `experience` (enum: beginner / intermediate / advanced)
   - `equipment` (enum: home / gym / minimal)
   - `training_days_per_week` (integer, 2-6)
   - `session_duration_minutes` (integer: 30 / 45 / 60 / 90)
   - RLS: user_id = auth.uid()

3. **Onboarding wizard UI** — multi-step form with two paths. Profile questionnaire is mandatory for all users (both guided and self-directed) to ensure we always have profile data.
   - Step 1: Welcome screen ("Let's build your program")
   - Step 2: Questionnaire — all profile fields (goal, experience, equipment, days/week, session duration, age, weight). Mandatory for both paths.
   - Step 3: Path choice — two first-class options:
     - **"Recommend me a program"** → guided path (Steps 4-5)
     - **"I'll build my own"** → self-directed path: creates an empty program shell (a `programs` row with null template_id), redirects to the builder. The user is in full control.
   - Step 4 (guided only): Template recommendation (ranked list based on profile, top pick highlighted)
   - Step 5 (guided only): Program summary (preview generated days + exercises) with "Create Program" button

   Two routes, shared step components:
   - `/onboarding` — first-time flow (Steps 1-5). Mandatory redirect on first login (no `programs` rows). Behind `AuthGuard`, outside `AppShell`.
   - `/change-program` — returning user flow (Steps 3-5 only: fork → recommendation → summary). Accessible from settings/side drawer. Behind `AuthGuard`, inside `AppShell`. Profile already exists so questionnaire is skipped.

   Wizard step components (`WelcomeStep`, `QuestionnaireStep`, `PathChoiceStep`, `TemplateRecommendationStep`, `ProgramSummaryStep`) are shared between both routes — each page composes only the steps it needs.

4. **Program templates schema** — three new tables:
   - `program_templates` — name, description, min_days, max_days, primary_goal, experience_tags (text[])
   - `template_days` — template_id, day_label, day_number, muscle_focus
   - `template_exercises` — template_day_id, exercise_id, sets, rep_range (text, e.g. "6-8"), rest_seconds, sort_order

5. **Five seeded templates:**

   | Template | Days | Primary Goal | Experience | Notes |
   |---|---|---|---|---|
   | Full Body | 2-4 | General fitness | Beginner | Compound-heavy, low volume per muscle |
   | Upper/Lower | 3-4 | Hypertrophy | Intermediate | Balanced push/pull split |
   | PPL (Push/Pull/Legs) | 3-6 | Hypertrophy | Intermediate-Advanced | Classic bodybuilding split |
   | GZCLP | 3-4 | Strength | Beginner-Intermediate | Linear progression, tier system |
   | Muscular Endurance | 3-4 | Endurance | All levels | High reps (15-20+), short rest (30-60s), circuit-style supersets |

   Seed data: AI-drafted exercise assignments from the 600+ library, validated manually. Each template has 3-6 day structures with 4-8 exercises per day.

6. **Exercise swap table** — new `exercise_alternatives` table:
   - `exercise_id` (FK) — the gym-default exercise
   - `alternative_exercise_id` (FK) — the home/minimal equipment substitute
   - `equipment_context` (text: "home" or "minimal")

   Templates are authored for gym. At program generation time, if the user selected "home" or "minimal" equipment, the generator looks up swaps and substitutes. Keeps template authoring simple; swap table is a small, auditable dataset. **Note:** the exercise library's equipment data is coarse (e.g. "machine" without specifics) — the swap table only needs to cover the ~30-50 unique exercises actually used in templates, not all 600.

7. **Recommendation engine** — deterministic filter + rank:
   1. Filter templates where user's `training_days_per_week` falls in `[min_days, max_days]`
   2. Rank by goal match (template.primary_goal == user.goal scores highest)
   3. Tiebreak by experience fit (template.experience_tags includes user.experience)
   4. All frequency-matching templates are shown regardless of equipment — exercise swaps are best-effort at generation time (unswapped exercises remain as-is; user can edit in the builder)

   ~20 lines of pure logic. No ML, no black box.

8. **Program generation** — given a selected template + user profile:
   1. Create a `programs` row (user_id, template_id, is_active = true)
   2. Deactivate any existing active program (is_active = false)
   3. For each `template_day`: create a `workout_day` (program_id, user_id, label, emoji, sort_order)
   4. For each `template_exercise`: resolve equipment swaps if needed, then create a `workout_exercise` with adapted sets/reps based on experience level:
      - Beginner: higher end of rep range, standard sets (3), longer rest
      - Intermediate: mid-range reps, standard sets (3-4), standard rest
      - Advanced: full rep range, higher sets (4-5), shorter rest
   5. Invalidate React Query cache for workout-days

9. **Generic analytics events** — new `analytics_events` table:
   - `id` (uuid PK)
   - `event_type` (text)
   - `user_id` (FK, nullable for anonymous events)
   - `payload` (jsonb)
   - `created_at` (timestamptz)

   Tracks: onboarding_started, onboarding_step_completed, template_selected, program_created, onboarding_skipped. Reusable by any future feature.

10. **Self-directed path and skip behavior** — the "I'll build my own" path at Step 3 is the primary opt-out for advanced users. It creates an empty program and sends them to the builder — a deliberate, first-class choice, not a bail-out. A small "skip" link also remains on guided steps 4-5 as a safety valve, with the same behavior (empty program + builder redirect).

11. **WorkoutPage empty state** — when a user has an active program with no workout_days (self-directed path, or after skipping), WorkoutPage shows a purposeful empty state that explains the situation and links to the builder. Replaces the current `useBootstrapProgram` auto-trigger.

12. **Template switching** — accessible from settings/side drawer via "Change Program" link, navigates to `/change-program`. User can pick a new template (guided) or switch to self-directed. Generates new program, deactivates old one. Old sessions remain linked to old workout_days (preserved under the inactive program).

**Out of scope:**

- Expanding the exercise library beyond existing ~600 exercises
- Custom exercise creation
- AI-powered or adaptive recommendations (we use deterministic logic)
- Social features, template sharing, or a template marketplace
- Workout scheduling or calendar integration
- Bro Split and other templates beyond the initial 5 (trivially addable later as seed data)
- Session duration-based volume adaptation (deferred — can be layered in)
- Inline exercise editing in the program summary step (remove/swap exercises before creating) — deferred, users can customize in the builder after creation

---

## Delivery Phases

**Phase 1 — Schema Foundation + Query Refactor**

- Migrations: `programs`, `user_profiles`, `program_templates`, `template_days`, `template_exercises`, `exercise_alternatives`, `analytics_events`
- Add `program_id` FK to `workout_days`
- TypeScript types for all new entities
- **Refactor all existing hooks** that touch `workout_days` to scope through active program (`useWorkoutDays`, `useWorkoutExercises`, `useBuilderMutations`, session creation). This is the highest-risk work — must be done carefully with tests.
- New WorkoutPage empty state component (purposeful UI when no workout_days exist under active program)

**Phase 2 — Templates + Onboarding Wizard + Program Generation**

- Seed 5 templates with exercise assignments (AI-drafted, manually validated)
- Populate exercise_alternatives swap table
- Onboarding wizard UI (all 5 steps: welcome, questionnaire, path choice, template recommendation, program summary + create)
- Recommendation engine (filter + rank)
- Questionnaire saves to user_profiles
- Program generation logic (template + profile → programs + workout_days + workout_exercises)
- Self-directed path (empty program + builder redirect)
- Wire onboarding redirect on first login (no `programs` rows) and delete `useBootstrapProgram`

**Phase 3 — Polish + Switching + Analytics**

- `/change-program` route + side drawer entry point
- Analytics event tracking throughout wizard
- Edge cases (re-onboarding, profile editing)
- i18n for all new strings (FR/EN)

---

## Success Criteria

- **Numeric:** >= 80% of new users who start onboarding complete it — either create a program or choose the self-directed path (via analytics events)
- **Numeric:** 100% of 5 seeded templates generate valid, runnable programs for all 3 equipment modes
- **Numeric:** Equipment swaps produce at least 1 alternative for every equipment-restricted exercise
- **Qualitative:** A user with no fitness knowledge can complete onboarding and start a workout within 2 minutes
- **Qualitative:** Both the self-directed path and skip safety valve leave the app in a usable state (empty program + builder access + purposeful WorkoutPage empty state)
- **Qualitative:** Generated programs are fully editable in the existing workout builder
- **Qualitative:** Switching templates creates a new program without affecting session history
- **Qualitative:** The recommendation engine's top pick is the objectively best match for a given profile (verifiable via unit tests on the scoring function)

---

## Dependencies

- **Exercise Library (Issue #1):** Templates reference exercises from the `exercises` table. The library already has ~600 exercises with equipment tags, difficulty levels, and muscle groups — sufficient coverage to populate all 5 templates.

---

## Open Questions

- Exact exercise assignments per template day will be AI-drafted and require manual validation — this is a content task, not a code task
- Whether rest times adapt by experience level (currently only sets/reps adapt) — deferred, easy to add
- Whether "archived" programs should be viewable in a dedicated UI or just preserved silently for history integrity — deferred
