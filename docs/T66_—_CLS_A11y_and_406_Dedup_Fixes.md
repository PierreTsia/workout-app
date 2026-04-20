# T66 — CLS, A11y & 406/Dedup Fixes

## Goal

Eliminate layout shift on the logged-in home view (`/`), fix the non-composited animations flagged by Lighthouse, add accessible names and proper tap-target sizes to the workout-day carousel's pager dots, and stop the Supabase 406 + duplicate request pattern caused by imperative admin/program probes at login. This ticket is the P0 correctness + UX quick-win of Epic #104.

## Dependencies

None. Independent of T67/T68/T69.

## Scope

### CLS fix — `file:src/pages/WorkoutPage.tsx`

Replace the page-level `<Loader2 />` spinner (around line 923, in the `daysLoading` branch) with a new `<WorkoutHomeSkeleton />` component that matches the final layout pixel-for-pixel.

### CLS fix — `file:src/components/workout/WorkoutDayCarousel.tsx`

- Add `min-h-[Xpx]` on the root `div.space-y-3` (the element Lighthouse flagged for the 0.82 shift). Measure `X` from a rendered `WorkoutDayCard` and bake it into a CSS custom property (`--workout-day-card-min-h`) for future tweaking.
- Keep the existing Embla `Carousel` unchanged; the shift comes from the absence of a reserved height, not from the carousel itself.

### Pager dots — `file:src/components/workout/WorkoutDayCarousel.tsx` (lines 104-116)

Replace current pager dot markup:

```tsx
<button className="h-1.5 rounded-full transition-all w-1.5 (or w-4 when active)" />
```

With a composited, accessible version:

```tsx
<button
  type="button"
  onClick={() => api?.scrollTo(idx)}
  aria-label={`Go to slide ${idx + 1}`}
  aria-current={idx === activeSlide ? "true" : undefined}
  className="flex min-h-6 min-w-6 items-center justify-center"
>
  <span
    className={cn(
      "h-1.5 w-4 rounded-full bg-muted-foreground/30 transition-transform",
      idx === activeSlide && "bg-primary",
    )}
    style={{
      transform: idx === activeSlide ? "scaleX(1)" : "scaleX(0.375)",
      transformOrigin: "center",
    }}
  />
</button>
```

This gives us: composited transform animation (no more "non-composited" Lighthouse flag), 24×24px tap target, and `aria-label` for screen readers.

### Card shadow — `file:src/components/workout/WorkoutDayCard.tsx` (lines 45-52)

Replace `transition-shadow` + conditional `shadow-lg`:

```tsx
<div className={cn(
  "rounded-xl border bg-card p-5 transition-shadow",
  isActive ? "border-primary/60 shadow-lg shadow-primary/10" : "border-border",
)}>
```

With a pre-painted ring whose opacity animates (composited):

```tsx
<div className={cn(
  "rounded-xl border bg-card p-5 ring-2 ring-primary/0 transition-[box-shadow,border-color] duration-200",
  isActive ? "border-primary/60 ring-primary/30" : "border-border",
)}>
```

Note: we still use `transition-[border-color]` because that's cheap and already animated today. The key win is removing the shadow animation.

### BodyMap slot reservation — `file:src/components/workout/WorkoutDayCard.tsx` (lines 78-87)

Wrap the `BodyMap` / pulse placeholder block in a container with fixed intrinsic size:

```tsx
<div className="flex min-h-[140px] items-center justify-center">
  {exercises && exercises.length > 0 ? (
    <BodyMap data={heatmapData} />
  ) : exercises ? null : (
    <div className="flex gap-3 py-6">
      <div className="h-28 w-14 animate-pulse rounded bg-muted" />
      <div className="h-28 w-14 animate-pulse rounded bg-muted" />
    </div>
  )}
</div>
```

Measure the actual BodyMap height in the rendered app and adjust `min-h-[Xpx]` accordingly.

### CycleProgressHeader — `file:src/components/workout/CycleProgressHeader.tsx` (lines 29-33)

Replace `transition-all` + inline `width: ${pct}%` with `transform: scaleX(pct/100)`:

```tsx
<div className="h-1.5 overflow-hidden rounded-full bg-muted">
  <div
    className="h-full origin-left rounded-full bg-primary transition-transform duration-300"
    style={{ transform: `scaleX(${pct / 100})` }}
  />
</div>
```

### Full skeleton — `file:src/components/workout/WorkoutHomeSkeleton.tsx` (new)

Static Tailwind skeleton matching the real layout. No external dep. Rough structure:

```tsx
export function WorkoutHomeSkeleton() {
  return (
    <div className="flex-1 space-y-4 overflow-hidden pb-20">
      {/* Cycle progress header */}
      <div className="px-4 pt-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-1.5 w-full animate-pulse rounded-full bg-muted" />
      </div>

      {/* Carousel placeholder */}
      <div className="space-y-3" style={{ minHeight: "var(--workout-day-card-min-h, 320px)" }}>
        <div className="px-4">
          <div className="h-[280px] animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          ))}
        </div>
      </div>

      {/* Exercise list placeholder */}
      <div className="space-y-2 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 406 + dedup — `file:src/lib/supabase.ts`

**Delete** the following blocks (approximate lines — confirm during implementation):
- `checkAdminStatus` function body (lines ~55-70)
- `checkProgramStatus` function body (lines ~35-50)
- The `getSession().then(...)` callback that calls both (lines ~72-80)
- The `onAuthStateChange('SIGNED_IN', ...)` wiring that calls them (lines ~109-115)

Keep:
- Supabase client creation and export
- Any session-state-forwarding to Jotai atoms that does NOT hit the DB

### `useIsAdmin` rewrite — `file:src/hooks/useIsAdmin.ts`

Rewrite as a TanStack Query hook:

```typescript
export function useIsAdmin() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user?.email) return false
      const { data } = await supabase
        .from("admin_users")
        .select("email")
        .eq("email", user.email)
        .maybeSingle()
      return !!data
    },
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
```

Return shape must stay compatible with existing callers (`file:src/components/admin/AdminOnly.tsx`, `file:src/router/AdminGuard.tsx`). Add a `.data` unwrap or wrapper to preserve the current boolean API.

### `useActiveProgram` tweak — `file:src/hooks/useActiveProgram.ts`

Swap `.single()` → `.maybeSingle()` and simplify the error branch:

```typescript
const { data, error } = await supabase
  .from("programs")
  .select("id, user_id, name, template_id, is_active, archived_at, created_at")
  .eq("user_id", user!.id)
  .eq("is_active", true)
  .maybeSingle()

if (error) throw error
return data ?? null
```

Remove the `PGRST116` special-case branch (now unreachable).

### Atom bridge — `file:src/components/AppShell.tsx`

Add a small effect that mirrors query results into existing Jotai atoms:

```typescript
const isAdminQuery = useIsAdmin()
const activeProgramQuery = useActiveProgram()
const setIsAdmin = useSetAtom(isAdminAtom)
const setActiveProgramId = useSetAtom(activeProgramIdAtom)

useEffect(() => {
  if (isAdminQuery.isSuccess) setIsAdmin(isAdminQuery.data)
}, [isAdminQuery.isSuccess, isAdminQuery.data, setIsAdmin])

useEffect(() => {
  if (activeProgramQuery.isSuccess) setActiveProgramId(activeProgramQuery.data?.id ?? null)
}, [activeProgramQuery.isSuccess, activeProgramQuery.data, setActiveProgramId])
```

Atoms stay. Full deletion deferred to follow-up.

### Optional: content-visibility hints

On `file:src/components/workout/ExerciseListPreview.tsx` and `file:src/components/workout/ExerciseEditRowControls.tsx` row containers, add:

```tsx
style={{ contentVisibility: "auto", containIntrinsicSize: "auto 56px" }}
```

Low risk, pure render perf improvement. Skip if it breaks any visual test.

## Out of Scope

- Route-level code splitting → **T67**
- Vendor chunk splitting, bundle analyzer, third-party script deferral → **T68**
- `useWorkoutExercises` embed / N+1 / library slim → **T69**
- Full deletion of `isAdminAtom` and `activeProgramIdAtom` → follow-up after T66 ships
- Deferring `react-day-picker/style.css` or i18n locales → future optimization
- SEO `meta name="description"` addition (P2 in the issue) → can land in T69 or a follow-up

## Acceptance Criteria

- [ ] Lighthouse mobile (clean incognito profile) shows **CLS < 0.1** on `/` after login.
- [ ] Lighthouse no longer flags pager dot animations as "non-composited" (transform-based).
- [ ] Lighthouse no longer flags the `WorkoutDayCard` as having non-composited `box-shadow` animation.
- [ ] Pager dot buttons have `aria-label="Go to slide N"` and `aria-current` on the active dot; axe audit passes on accessible name.
- [ ] Pager dot tap target is ≥24×24px (axe tap-target passes).
- [ ] No Supabase `406` errors in the browser console on cold load (new user, returning user, admin, non-admin all verified).
- [ ] Network panel shows exactly **one** `admin_users?email=eq…` request on login and **one** `programs?…is_active=eq.true` request.
- [ ] `useIsAdmin` consumers in `file:src/components/admin/AdminOnly.tsx` and `file:src/router/AdminGuard.tsx` still render correctly with no UI regression.
- [ ] `WorkoutPage` renders the full skeleton (no raw spinner) during `daysLoading`.
- [ ] `WorkoutDayCard` content height does not shift when `exercises` resolves (BodyMap slot reserved).
- [ ] No TypeScript errors; `npx tsc --noEmit` passes.
- [ ] No Vitest regressions on existing test suite.

## References

- Epic / issue: [#104 — Improve Lighthouse: CLS, LCP, Supabase payload & 406 errors](https://github.com/PierreTsia/workout-app/issues/104)
- Tech Plan: `file:docs/Tech_Plan_—_Lighthouse_CLS_LCP_Supabase_#104.md`
- Files touched: `WorkoutPage`, `WorkoutDayCarousel`, `WorkoutDayCard`, `CycleProgressHeader`, `WorkoutHomeSkeleton` (new), `supabase.ts`, `useIsAdmin`, `useActiveProgram`, `AppShell`
