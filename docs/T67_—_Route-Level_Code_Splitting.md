# T67 — Route-Level Code Splitting

## Goal

Split the monolithic JS bundle (~716 KB transferred, 65% unused) into per-route chunks so the logged-in home route (`/`) loads only what it needs. Keep the workout flow (`/`, `/login`, `/onboarding`, `/create-program`) in the main chunk; lazy-load everything else behind `React.lazy` with a shared `<Suspense>` fallback. This is the largest single LCP lever identified in Epic #104.

## Dependencies

- **T66** should ship first so the `AppShell` layout is stable and new `<Suspense>` boundaries don't introduce fresh CLS.

## Scope

### Router refactor — `file:src/router/index.tsx`

Convert the following static imports to `React.lazy(() => import(...))`:

**Lazy-load (non-critical-path):**
- `HistoryPage`
- `BuilderPage`
- `LibraryProgramsPage`
- `ExerciseLibraryPage`
- `ExerciseLibraryExercisePage`
- `AccountPage`
- `AchievementsPage`
- `CycleSummaryPage`
- `AdminHomePage`
- `AdminExercisesPage`
- `AdminExerciseEditPage`
- `AdminReviewPage`
- `AdminEnrichmentPage`
- `AdminFeedbackPage`
- `OAuthConsentPage`
- `PrivacyPage`
- `AboutPage`

**Keep eager (critical path or blocks auth flow):**
- `WorkoutPage` (the `/` LCP surface)
- `LoginPage`
- `OnboardingPage`
- `CreateProgramPage`
- `AppShell`
- `AuthGuard`, `OnboardingGuard`, `AdminGuard`

### Suspense wrapping

Each lazy route element needs a Suspense boundary. Two options — pick one:

**Option A (recommended):** Wrap each lazy element inline:

```tsx
{
  path: "history",
  element: (
    <Suspense fallback={<RouteSkeleton />}>
      <HistoryPage />
    </Suspense>
  ),
}
```

**Option B:** Single Suspense boundary inside `AppShell` between the outlet and the nav bar:

```tsx
<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
  <Suspense fallback={<RouteSkeleton />}>
    <Outlet />
  </Suspense>
</main>
```

Option B is one line of code but means any lazy route triggers the same fallback. Option A is more code but allows per-route skeletons later (e.g. specialized history skeleton). **Use Option B unless a specific route needs a custom skeleton.**

### New `RouteSkeleton` — `file:src/components/RouteSkeleton.tsx`

Minimal component:

```tsx
export function RouteSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
```

If a specific lazy route suffers from visible flash (history with its charts, for instance), upgrade to a tailored skeleton in a follow-up.

### Verify no critical-path regression

- `npm run build` produces separate chunks for admin, history, library, builder.
- Initial chunk for `/` does NOT contain: `recharts`, `@tanstack/react-table`, admin page components, `cmdk` (if still bundled, deferred to T68 via `manualChunks`).
- `/` Lighthouse LCP improves by at least 1s on mobile simulated 3G.

## Out of Scope

- Manual vendor chunk splitting (`build.rollupOptions.output.manualChunks`) → **T68**
- Bundle analyzer script → **T68**
- Deferring Sentry / PostHog / SW initialization → **T68**
- Prefetch on nav hover (optional future polish)
- Converting `/login` or `/onboarding` to lazy (keep critical auth path eager)

## Acceptance Criteria

- [ ] `file:src/router/index.tsx` imports the listed routes via `React.lazy(() => import(...))`.
- [ ] `/` loads without any admin/history/library/builder code in the initial chunk (verified via `npm run build` output or manual inspection of `dist/assets/*.js`).
- [ ] First admin nav click successfully loads the admin chunk and renders correctly.
- [ ] First `/history` nav click successfully loads the recharts-containing chunk.
- [ ] `<Suspense>` fallback (`RouteSkeleton`) renders briefly between lazy route transitions on slow network.
- [ ] Initial JS transfer on `/` mobile Lighthouse is **< 400 KB** (down from 716 KB baseline).
- [ ] No TypeScript errors; `npx tsc --noEmit` passes.
- [ ] No Playwright E2E regressions (login, workout session, builder flows).
- [ ] Route transitions still work for guarded routes (`AdminGuard`, `OnboardingGuard`).

## References

- Epic / issue: [#104](https://github.com/PierreTsia/workout-app/issues/104)
- Tech Plan: `file:docs/Tech_Plan_—_Lighthouse_CLS_LCP_Supabase_#104.md`
- React Router v7 lazy docs: https://reactrouter.com/en/main/route/lazy
