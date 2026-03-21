# T24 — TypeScript Types, Atoms & Auth-time Program Check

## Goal

Create the TypeScript type foundation and Jotai state management that all downstream tickets depend on. This includes new type definitions for all onboarding entities, updating the existing `WorkoutDay` interface with a required `program_id` field (and fixing all resulting compile errors), adding program-related Jotai atoms, and wiring the auth-time program status check.

## Dependencies

- T23 — Database Schema & Migrations (tables must exist for auth-time queries)

## Scope

### New Type Definitions

Create `file:src/types/onboarding.ts`:

| Type | Fields |
|---|---|
| `UserGoal` | Union: `'strength' \| 'hypertrophy' \| 'endurance' \| 'general_fitness'` |
| `UserExperience` | Union: `'beginner' \| 'intermediate' \| 'advanced'` |
| `UserEquipment` | Union: `'home' \| 'gym' \| 'minimal'` |
| `UserProfile` | `user_id`, `age`, `weight_kg`, `goal`, `experience`, `equipment`, `training_days_per_week`, `session_duration_minutes`, `created_at`, `updated_at` |
| `ProgramTemplate` | `id`, `name`, `description`, `min_days`, `max_days`, `primary_goal: UserGoal`, `experience_tags: UserExperience[]`, `template_days: TemplateDay[]` |
| `TemplateDay` | `id`, `template_id`, `day_label`, `day_number`, `muscle_focus`, `sort_order`, `template_exercises: TemplateExercise[]` |
| `TemplateExercise` | `id`, `template_day_id`, `exercise_id`, `sets`, `rep_range`, `rest_seconds`, `sort_order`, `exercise?: Exercise` |
| `Program` | `id`, `user_id`, `name`, `template_id`, `is_active`, `created_at` |
| `ExerciseAlternative` | `exercise_id`, `alternative_exercise_id`, `equipment_context` |

### Update Existing Types

Update `file:src/types/database.ts` — add `program_id: string` to `WorkoutDay` interface as a **required** field. Fix all resulting compile errors:

- `file:src/hooks/useBootstrapProgram.ts` — add `program_id` to day inserts (temporary fix; file is deleted in T25)
- `file:src/hooks/useBuilderMutations.ts` — add `program_id` to `useCreateDay` insert (placeholder value until T25 wires it to the atom)
- Test files that mock `WorkoutDay` objects — add `program_id` to fixtures
- Any other files that construct `WorkoutDay` literals

### New Jotai Atoms

Add to `file:src/store/atoms.ts`:

| Atom | Type | Default | Purpose |
|---|---|---|---|
| `hasProgramAtom` | `boolean` | `false` | Whether the user has any active program |
| `hasProgramLoadingAtom` | `boolean` | `true` | Loading state for the program check |
| `activeProgramIdAtom` | `string \| null` | `null` | The active program's UUID, available instantly without a query |

### Auth-time Program Check

Add `checkProgramStatus()` to `file:src/lib/supabase.ts`:

- Pattern: identical to existing `checkAdminStatus()` function
- Query: `supabase.from("programs").select("id").eq("user_id", userId).eq("is_active", true).single()`
- On success: `store.set(hasProgramAtom, true)`, `store.set(activeProgramIdAtom, data.id)`, `store.set(hasProgramLoadingAtom, false)`
- On error/no rows: `store.set(hasProgramAtom, false)`, `store.set(activeProgramIdAtom, null)`, `store.set(hasProgramLoadingAtom, false)`
- Wire into `onAuthStateChange`: call on `SIGNED_IN`, clear on `SIGNED_OUT`
- Wire into initial `getSession()` check

### useActiveProgram Hook

Create `file:src/hooks/useActiveProgram.ts`:

- React Query: `programs WHERE user_id = auth.uid() AND is_active = true`
- Query key: `["active-program", userId]`
- Returns the full `Program` object (needed when components need more than just the ID)

## Out of Scope

- Refactoring `useWorkoutDays` query to filter by program (T25)
- Behavioral changes to existing hooks (T25)
- OnboardingGuard or routing changes (T25)
- UI components

## Acceptance Criteria

- [ ] `src/types/onboarding.ts` compiles and all types match the SQL schema from T23
- [ ] `WorkoutDay.program_id` is required (`string`, not optional) in `src/types/database.ts`
- [ ] All existing code compiles with the updated `WorkoutDay` type (no `tsc` errors)
- [ ] `hasProgramAtom`, `hasProgramLoadingAtom`, and `activeProgramIdAtom` exist in `src/store/atoms.ts`
- [ ] `checkProgramStatus()` sets all three atoms correctly on SIGNED_IN
- [ ] `checkProgramStatus()` clears atoms on SIGNED_OUT
- [ ] `useActiveProgram` returns the active program or null
- [ ] Existing tests pass (with updated WorkoutDay mocks)

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md` — Scope items 1, 2
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_&_Program_Generation.md` — TypeScript Types section, Modified Files table (atoms + supabase.ts), Key Decisions (onboarding signal + active program)
