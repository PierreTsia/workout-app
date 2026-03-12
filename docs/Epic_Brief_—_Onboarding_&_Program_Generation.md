# Epic Brief — Onboarding & Program Generation

## Summary

This epic introduces a guided onboarding wizard that captures a user's training profile (goals, experience, available equipment, preferred frequency, session duration), recommends a program template from a curated library, and auto-generates a personalized multi-day workout program. Templates are first-class persistent entities — programs link back to their source template, enabling users to switch programs or reset to defaults later. A new generic analytics events table tracks the onboarding funnel and template popularity. The feature is designed multi-user-ready from day one, replacing the current one-size-fits-all bootstrap with a personalized cold-start experience.

---

## Context & Problem

**Who is affected:** Any new user arriving at the app for the first time, and existing users who want to switch to a structured program.

**Current state:**
- When a user has no `workout_days`, `file:src/hooks/useBootstrapProgram.ts` auto-creates a hardcoded Push/Pull/Legs split (Pierre's personal program)
- No questionnaire, no profile capture, no personalization whatsoever
- The workout builder (`file:src/pages/BuilderPage.tsx`) exists with full CRUD but offers no guidance — it's a blank canvas for new users
- No concept of "program templates" — every program is built manually or accepted as the default bootstrap
- No user profile data is captured or stored beyond authentication

**Pain points:**

| Pain | Impact |
|---|---|
| No personalization | Every user gets the same Push/Pull/Legs regardless of goals, experience, or available equipment |
| Cold-start friction | New users must either accept a generic default or manually build a program from scratch in the builder |
| No user profile | App cannot adapt recommendations, volume, or exercise selection to the individual |
| No template ecosystem | Users cannot browse proven programs or switch between structured training approaches |
| No onboarding funnel data | No visibility into how new users engage with the app or where they drop off |

---

## Goals

| Goal | Measure |
|---|---|
| Reduce cold-start friction | >= 80% of new users who start onboarding complete it (reach "Create Program") |
| Personalized programs | 100% of generated programs respect the user's stated goal, experience, equipment, and frequency |
| Template discoverability | >= 5 templates available at launch, each with equipment variants |
| Multi-user readiness | Schema and UX support N users with fully isolated data (RLS) |
| Onboarding funnel visibility | Every onboarding step and template selection tracked via analytics events |

---

## Scope

**In scope:**

1. **User profile model** — new `user_profiles` table storing age, weight (kg), goal (strength / hypertrophy / endurance), experience (beginner / intermediate / advanced), equipment (home / gym / minimal), training days per week (2-6), and session duration (30 / 45 / 60 / 90 min). Linked to `auth.users` with RLS.
2. **Onboarding wizard UI** — multi-step form/wizard:
   - Step 1: Welcome screen ("Let's build your program")
   - Step 2: Questionnaire (profile fields above)
   - Step 3: Template recommendation (ranked list based on answers, top pick highlighted)
   - Step 4: Program summary (preview generated days + exercises)
   - Step 5: Confirm ("Create Program") or skip to empty builder
3. **Program templates schema** — three new tables:
   - `program_templates` — name, description, min/max days, goal tags, experience tags
   - `template_days` — template_id, day label, day number, muscle focus
   - `template_exercises` — template_day_id, exercise_id, sets, reps range, equipment required
4. **5-6 seeded templates** — PPL (3-6 days), Upper/Lower (4 days), Full Body (2-4 days), Bro Split (5-6 days), GZCLP (3-4 days), with day structures and exercise assignments referencing the `exercises` table
5. **Recommendation engine** — deterministic mapping from (goal, experience, equipment, days/week, session duration) to a ranked template list. Templates define a `min_days`/`max_days` range; the engine filters and ranks by fit.
6. **Program generation** — creates `workout_days` + `workout_exercises` rows from a selected template, with a `template_id` FK on `workout_days` preserving lineage
7. **Template switching** — ability to re-run onboarding or pick a different template from settings. Generates a new program; optionally archives the old one.
8. **Generic analytics events** — new `analytics_events` table with columns: event_type (text), user_id (FK), payload (JSONB), created_at (timestamptz). Tracks onboarding funnel steps, template selection, skip events, and drop-offs. Reusable by any future feature.
9. **Skip onboarding** — opt-out at any step, falling back to current bootstrap behavior or an empty builder

**Out of scope:**

- Expanding the exercise library beyond the current 23 system exercises (depends on Epic #1 — Exercise Library)
- Custom exercise creation (part of Exercise Library epic)
- AI-powered or adaptive recommendations
- Social features, template sharing, or a template marketplace
- Workout scheduling or calendar integration
- Wearable integration

---

## Success Criteria

- **Numeric:** >= 80% of new users who start onboarding reach the "Create Program" step (measured via analytics events)
- **Numeric:** 100% of seeded templates generate valid, runnable programs with correct exercise assignments for all supported equipment variants
- **Numeric:** Equipment variant swaps produce at least 1 alternative for every equipment-restricted exercise in each template
- **Qualitative:** A user with no fitness knowledge can complete onboarding and start their first workout session within 2 minutes
- **Qualitative:** Onboarding can be skipped at any step without breaking the app or leaving the user in a broken state
- **Qualitative:** Generated programs are fully editable in the existing workout builder after creation — no locked or read-only state
- **Qualitative:** A user can switch templates from settings and get a fresh program without losing access to their session history

---

## Dependencies

- **Exercise Library (Issue #1):** Templates reference exercises from the `exercises` table. The library must have sufficient coverage (equipment tags, muscle group variety) before templates can be meaningfully populated. **This epic ships after #1.**

---

## Open Questions

- Exact exercise assignments per template day depend on the final state of the Exercise Library (#1) — template seed data will need updating once that epic lands.
- Whether "archive old program" on template switch means soft-delete or a separate `archived_programs` table — to be decided in the Tech Plan.
- The adaptation logic for volume (sets/reps) based on experience level is defined at the template level, but whether rest times also adapt is TBD.
