# T23 — Database Schema & Migrations

## Goal

Create all database tables, RLS policies, triggers, and indexes required by the Onboarding & Program Generation epic. This is the foundation ticket — every subsequent ticket depends on these tables existing. Pure SQL, no application code.

## Dependencies

None.

## Scope

### New Tables

7 new tables, each in its own migration file for clean rollback:

| Migration | Table | Key Details |
|---|---|---|
| `create_programs` | `programs` | `id`, `user_id` (FK auth.users), `name`, `template_id` (nullable FK), `is_active`, `created_at`. RLS: user_id = auth.uid(). Unique partial index on `(user_id) WHERE is_active = true`. |
| `create_user_profiles` | `user_profiles` | `user_id` (PK, FK auth.users), `age`, `weight_kg`, `goal`, `experience`, `equipment`, `training_days_per_week`, `session_duration_minutes`, `created_at`, `updated_at`. RLS: user_id = auth.uid(). Includes `update_updated_at_column()` trigger function + trigger. |
| `create_program_templates` | `program_templates` | `id`, `name` (UNIQUE), `description`, `min_days`, `max_days`, `primary_goal`, `experience_tags` (text[]), `created_at`. RLS: SELECT for authenticated. |
| `create_template_days` | `template_days` | `id`, `template_id` (FK), `day_label`, `day_number`, `muscle_focus`, `sort_order`. RLS: SELECT for authenticated. |
| `create_template_exercises` | `template_exercises` | `id`, `template_day_id` (FK), `exercise_id` (FK exercises), `sets`, `rep_range`, `rest_seconds`, `sort_order`. RLS: SELECT for authenticated. |
| `create_exercise_alternatives` | `exercise_alternatives` | `id`, `exercise_id` (FK), `alternative_exercise_id` (FK), `equipment_context` (CHECK: home/minimal). UNIQUE(exercise_id, equipment_context). RLS: SELECT for authenticated. |
| `create_analytics_events` | `analytics_events` | `id`, `event_type`, `user_id` (FK, nullable, ON DELETE SET NULL), `payload` (jsonb), `created_at`. RLS: INSERT-only (no SELECT policy — add later if dashboard needed). |

### Modified Table

| Migration | Change |
|---|---|
| `add_program_id_to_workout_days` | `TRUNCATE workout_days CASCADE` (clean slate — no real users, only test data). Then `ALTER TABLE workout_days ADD COLUMN program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE`. Add `CREATE INDEX idx_workout_days_program_id ON workout_days(program_id)`. |

### CHECK Constraints

- `user_profiles.goal` IN ('strength', 'hypertrophy', 'endurance', 'general_fitness')
- `user_profiles.experience` IN ('beginner', 'intermediate', 'advanced')
- `user_profiles.equipment` IN ('home', 'gym', 'minimal')
- `user_profiles.training_days_per_week` BETWEEN 2 AND 6
- `user_profiles.session_duration_minutes` IN (30, 45, 60, 90)
- `exercise_alternatives.equipment_context` IN ('home', 'minimal')

### Migration Ordering

Migrations must run in this order due to FK dependencies:

1. `create_program_templates` (referenced by `programs.template_id`)
2. `create_programs` (referenced by `workout_days.program_id`)
3. `create_user_profiles`
4. `create_template_days` (references `program_templates`)
5. `create_template_exercises` (references `template_days` and `exercises`)
6. `create_exercise_alternatives` (references `exercises`)
7. `create_analytics_events`
8. `add_program_id_to_workout_days` (references `programs`)

## Out of Scope

- TypeScript type definitions (T24)
- Seed data for templates and exercise alternatives (T26)
- Application code, hooks, or UI components

## Acceptance Criteria

- [ ] All 7 new tables created with correct column types, constraints, and RLS policies
- [ ] `programs` has unique partial index on `(user_id) WHERE is_active = true`
- [ ] `workout_days.program_id` is NOT NULL FK with `idx_workout_days_program_id` index
- [ ] `update_updated_at_column()` trigger function exists and fires on `user_profiles` UPDATE
- [ ] `TRUNCATE workout_days CASCADE` clears existing test data before ALTER
- [ ] `supabase db reset` runs clean with no errors
- [ ] All RLS policies enforce correct access patterns (user-scoped for user data, authenticated-read for templates)

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md` — Scope items 1, 2, 4, 6, 9
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_&_Program_Generation.md` — Data Model section (full SQL schemas)
