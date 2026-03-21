# Epic Brief — Error Boundaries & Graceful Error UI

## Summary

Add layered error boundaries so that a crash in one component (or a failed network call) never results in a blank screen or an ugly browser error. Users see a themed fallback UI with a clear message and recovery actions (retry / go home). Dev mode surfaces the stack trace for debugging.

---

## Context & Problem

**Who is affected:** All users — any unhandled JS error or Supabase failure currently kills the entire app.

**Current state:**
- Zero error boundaries — no `react-error-boundary`, no class-based boundary, no `errorElement` on routes
- React Query is configured with `retry: 1` but no global `onError`; `isError` is checked in exactly one place (`WorkoutPage` bootstrap)
- Toast notifications exist (sonner) but are used only in admin save, feedback submit, and image upload
- No `window.onerror` or unhandled rejection listener
- No Suspense boundaries

**Pain points:**
| Pain | Impact |
|---|---|
| Render error in any component → full white screen | User loses in-progress workout data context, has to hard-refresh |
| Supabase RPC / query failure → silent noop in most views | User sees stale or empty data with no indication something broke |
| No way to retry from the UI | User must manually refresh the page |
| No dev-mode diagnostics | Developer must open browser console to find the error |

---

## Goals

| Goal | Measure |
|---|---|
| No more white screens from uncaught render errors | 100% of route-level and app-level errors caught by a boundary |
| Clear recovery path for the user | Every error fallback has at least "Retry" and "Go Home" actions |
| Dev-mode stack trace visibility | Stack trace rendered in fallback UI when `import.meta.env.DEV` is true |
| Consistent query error feedback | Global query `onError` shows a toast; critical pages show inline error states |

---

## Scope

**In scope:**
1. Route-level error handling via React Router `errorElement`
2. App-level error boundary wrapping `<RouterProvider>` in `file:src/main.tsx`
3. Themed `ErrorFallback` component matching dark/light design system
4. Global React Query `onError` default (toast on mutation failure)
5. Inline error states for key query-driven pages (Workout, History, Builder)
6. Dev-mode stack trace display in fallback UI

**Out of scope:**
- External error logging (Sentry / LogRocket) — deferred, separate concern
- Suspense boundaries and skeleton loading states — separate issue
- Retry logic beyond React Query's built-in `retry: 1`

---

## Success Criteria

- **Numeric:** 0 white-screen scenarios reachable from any route
- **Qualitative:** Error fallback renders in-theme, is mobile-friendly, and offers actionable recovery (retry resets the boundary / navigates home)
