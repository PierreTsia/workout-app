# T27 — Recommendation Engine & Program Generation Logic

## Goal

Build all the hooks and pure logic that power template selection and program creation. This includes fetching templates from the database, ranking them based on a user's profile, adapting sets/reps by experience level, resolving equipment swaps, and orchestrating the full program generation flow. No UI in this ticket — all logic is consumed by the wizard UI in T28.

## Dependencies

- T24 — TypeScript Types, Atoms & Auth-time Program Check (types and atoms must exist)
- T26 — Template Seed Data & Exercise Alternatives (templates and swaps must exist in the database)

## Scope

### Data Fetching Hooks

**`file:src/hooks/useTemplates.ts`**
- React Query hook
- Fetches `program_templates` with nested `template_days(template_exercises(exercise:exercises(*)))`
- Returns the full template tree (`ProgramTemplate[]` with nested days and exercises)
- Query key: `["program-templates"]`

**`file:src/hooks/useExerciseAlternatives.ts`**
- React Query hook
- Fetches `exercise_alternatives` table
- Returns `ExerciseAlternative[]`
- Query key: `["exercise-alternatives"]`
- Used by program generation for swap resolution

### Recommendation Engine

**`file:src/lib/recommendTemplates.ts`**
- Pure function: `rankTemplates(templates: ProgramTemplate[], profile: UserProfile) => ProgramTemplate[]`
- Filter: `profile.training_days_per_week` must fall within `[template.min_days, template.max_days]`
- Score: +10 for `template.primary_goal === profile.goal`, +5 for `template.experience_tags.includes(profile.experience)`
- Sort: descending by score, then alphabetically by `template.name` as a stable deterministic tiebreak
- Returns all frequency-matching templates (not just top 1)
- ~20 lines of pure logic, easily unit-testable

**Unit tests for `rankTemplates`:**
- Profile with goal=hypertrophy, 4 days/week → PPL and Upper/Lower ranked highest
- Profile with goal=strength, 3 days/week → GZCLP ranked first
- Profile with 2 days/week → only Full Body matches (others require 3+)
- Tiebreak: two templates with same score sorted alphabetically
- No matches: returns empty array

### Program Generation Logic

**`file:src/lib/generateProgram.ts`**
- Pure function for adapting sets/reps by experience level:
  - Beginner: higher end of rep range, 3 sets, longer rest (+15s)
  - Intermediate: mid-range reps, 3-4 sets, standard rest
  - Advanced: full rep range, 4-5 sets, shorter rest (-15s)
- Parses `rep_range` text (e.g. "6-8") into min/max, selects target based on experience
- Equipment swap resolution: given `ExerciseAlternative[]` and `UserEquipment`, returns the substitute exercise_id or the original if no swap exists

### useGenerateProgram Hook

**`file:src/hooks/useGenerateProgram.ts`**
- Mutation hook
- Input: `{ templateId: string | null, templateName: string | null, profile: UserProfile }`
- Steps:
  1. Set any existing active program to `is_active = false` (UPDATE)
  2. Insert new `programs` row (`name`, `template_id`, `user_id`, `is_active = true`). Name = `templateName` for guided, `"My Program"` for self-directed.
  3. If `templateId` is not null (guided path):
     - Fetch template with days and exercises (or use pre-fetched data)
     - Fetch exercise alternatives for user's equipment
     - For each template_day: insert `workout_day` (with `program_id`, `user_id`, `label`, `emoji`, `sort_order`)
     - For each template_exercise: resolve swap if needed, adapt sets/reps via `generateProgram.ts`, insert `workout_exercise`
  4. Invalidate `["workout-days"]` and `["active-program"]` query caches
  5. Set `hasProgramAtom = true` and `activeProgramIdAtom = newProgramId`
- If `templateId` is null (self-directed): only steps 1-2 and 4-5 (empty program)

### useCreateUserProfile Hook

**`file:src/hooks/useCreateUserProfile.ts`**
- Mutation hook
- Upsert pattern: `INSERT INTO user_profiles ... ON CONFLICT (user_id) DO UPDATE`
- Allows re-onboarding to update an existing profile
- Weight is received in the user's preferred unit and converted to kg before saving

## Out of Scope

- UI components and wizard flow (T28)
- Template seed data authoring (T26)
- Analytics instrumentation (T29)
- i18n strings (T28)

## Acceptance Criteria

- [ ] `useTemplates` returns the full template tree with nested days and exercises
- [ ] `rankTemplates` correctly ranks templates for various profile combinations (unit tests pass)
- [ ] `rankTemplates` returns empty array when no templates match the user's frequency
- [ ] `generateProgram.ts` adapts sets/reps correctly per experience level (beginner/intermediate/advanced)
- [ ] Equipment swaps are applied for home/minimal profiles, original kept when no swap exists
- [ ] `useGenerateProgram` creates a complete program with workout days and exercises
- [ ] `useGenerateProgram` deactivates old program before creating new one (unique index safe)
- [ ] `useGenerateProgram` sets both `hasProgramAtom` and `activeProgramIdAtom` after creation
- [ ] `useCreateUserProfile` inserts on first call, updates on subsequent calls (upsert)
- [ ] Self-directed path (null templateId) creates an empty program with no workout days

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md` — Scope items 7, 8
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_&_Program_Generation.md` — Component Responsibilities (rankTemplates, useGenerateProgram), New Files table, Phase 2 steps 3-7
