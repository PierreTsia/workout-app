# T25 — Query Refactor, OnboardingGuard & WorkoutPage Empty State

## Goal

Make the existing app fully program-aware by refactoring all hooks that touch `workout_days` to scope through the active program. Add the `OnboardingGuard` route protection, update the route tree, create a functional placeholder at `/onboarding`, and replace the old bootstrap auto-trigger with a purposeful empty state on WorkoutPage. This is the highest-risk ticket in the epic — it touches the app's core data flow.

## Dependencies

- T24 — TypeScript Types, Atoms & Auth-time Program Check (atoms and types must exist)

## Scope

### Hook Refactors

**`file:src/hooks/useWorkoutDays.ts`**
- Read `programId` from `activeProgramIdAtom` via `useAtomValue`
- Add `.eq("program_id", programId)` filter to the Supabase query
- Update query key from `["workout-days", userId]` to `["workout-days", userId, programId]`
- Disable query when `programId` is null (`enabled: !!programId`)

**`file:src/hooks/useBuilderMutations.ts`**
- `useCreateDay`: read `activeProgramIdAtom`, include `program_id` in the INSERT payload
- Other mutations (update, delete, reorder) operate on existing day IDs — no changes needed
- Update cache invalidation key to `["workout-days", userId, programId]`

**`file:src/lib/syncService.ts`**
- `resolveSessionMeta`: update React Query cache key lookup from `["workout-days", userId]` to `["workout-days", userId, programId]`
- Read `programId` via `store.get(activeProgramIdAtom)` — syncService is a plain module, not a React component, so it uses the Jotai store directly (same pattern as `file:src/lib/supabase.ts`)

### OnboardingGuard Component

Create `file:src/router/OnboardingGuard.tsx`:

- Reads `hasProgramAtom` and `hasProgramLoadingAtom` via `useAtomValue`
- Loading → returns `null` (blank screen, consistent with `AuthGuard` / `AdminGuard`)
- No program (`hasProgramAtom === false`) → `<Navigate to="/onboarding" replace />`
- Has program → `<Outlet />`

### Route Structure Update

Update `file:src/router/index.tsx`:

- Add `OnboardingGuard` wrapper between `AuthGuard` and `AppShell`
- Add `/onboarding` route inside `AuthGuard` but outside `OnboardingGuard` (avoids redirect loops)
- `/change-program` route placeholder (empty, wired in T29)

### /onboarding Placeholder Page

Create a minimal `file:src/pages/OnboardingPage.tsx` (placeholder — replaced by full wizard in T28):

- Reads `hasProgramAtom`: if true → `<Navigate to="/" replace />` (prevents re-entry)
- Renders a simple "Get Started" button that creates an empty program (self-directed path):
  - Insert `programs` row with `name: "My Program"`, `template_id: null`, `is_active: true`
  - Set `hasProgramAtom = true` and `activeProgramIdAtom = newId`
  - Navigate to `/builder`
- This ensures the app is fully functional at the end of Phase 1, before the full wizard lands in T28

### WorkoutPage Empty State

Update `file:src/pages/WorkoutPage.tsx`:

- Remove `useBootstrapProgram` import and usage
- Remove the `useEffect` that triggers `bootstrap.mutate()`
- New empty state: when active program has no `workout_days`, show purposeful UI:
  - Explanation text ("Your program has no workout days yet")
  - CTA button linking to `/builder`
  - Visually polished, not a sad error state

### Delete useBootstrapProgram

Delete `file:src/hooks/useBootstrapProgram.ts` — its only consumer (WorkoutPage) is refactored in this ticket. No other files import it.

### Test Updates

- Update all existing tests that reference the `["workout-days", userId]` query key to `["workout-days", userId, programId]`
- Update test fixtures that mock `useWorkoutDays` or `useBuilderMutations`
- Add basic tests for `OnboardingGuard` (redirect when no program, render outlet when program exists)

## Out of Scope

- Full onboarding wizard UI (T28)
- Template seed data (T26)
- Program generation logic (T27)
- Analytics instrumentation (T29)
- `/change-program` functionality (T29)

## Acceptance Criteria

- [ ] `useWorkoutDays` only returns days for the active program (filtered by `program_id`)
- [ ] `useWorkoutDays` query is disabled when `activeProgramIdAtom` is null
- [ ] Creating a day in the builder includes `program_id` from the active program atom
- [ ] `syncService.resolveSessionMeta` uses the updated cache key with `programId`
- [ ] User without a program is redirected to `/onboarding` by `OnboardingGuard`
- [ ] `/onboarding` placeholder creates an empty program and redirects to `/builder`
- [ ] Already-onboarded user navigating to `/onboarding` is redirected to `/`
- [ ] WorkoutPage shows empty state when active program has no workout days
- [ ] `file:src/hooks/useBootstrapProgram.ts` is deleted with no remaining imports
- [ ] All existing tests pass with updated query keys and mocks

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md` — Scope items 1, 3, 11
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_&_Program_Generation.md` — Critical Constraints, Modified Files table, Component Responsibilities (OnboardingGuard, OnboardingPage), Phase 1 steps 11-17
