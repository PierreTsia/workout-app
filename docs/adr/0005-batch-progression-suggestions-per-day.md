# ADR 0005 — Batch progression suggestions per workout day

- **Status:** Accepted
- **Date:** 2026-05-27
- **Decided in:** chat (grilling for issue #371 — pre-session list shows stale template weight)

## Context

The pre-session exercise list (`PreSessionExerciseList` + `ExerciseEditRowControls`) currently displays each row's **Template Prescription** (`workout_exercises.weight` / `reps` / `sets`). This drifts from reality whenever the engine has a **Progression Suggestion** that differs — including non-trivial `HOLD_*` cases where the **Last Performance** weight has surpassed the template (the typical "I've been lifting 57 for weeks but the row says 48" scenario).

Issue #371 fixes this by showing the **Progression Suggestion** values on each row, plus a compact `ProgressionPill` indicator.

The straightforward path is to call the existing per-exercise hook `useProgressionSuggestion(exercise)` from each row component. That hook subscribes to one Supabase query per row (via `useLastSessionDetail`).

`WorkoutDayCarousel` can render up to ~3 visible workout days × ~8 exercises = **~24 parallel Supabase queries** on home-screen mount. Mid-tier mobile + Lighthouse budgets are already pressured (cf. `docs/done/Tech_Plan_—_Lighthouse_CLS_LCP_Supabase_#104.md`); blasting 24 concurrent reads on every load of the workout home is wasteful for what is effectively a derived view.

## Decision

We will introduce a parent-scoped aggregator hook **`useProgressionSuggestionsForDay(dayId, exercises)`** that fetches **Last Performance** for all N exercises of the day in a single Supabase query, then runs `computeNextSessionTarget` per row client-side. The hook returns `Map<exercise_id, ProgressionSuggestion | null>`, consumed by `PreSessionExerciseList` (and passed down to row components) as a prop.

The per-exercise `useProgressionSuggestion` stays as-is for in-session callers (`ExerciseDetail`), where only one exercise is in scope and per-row subscription is the right shape.

This establishes a pattern: **per-row engine derivations across a list are batched at the parent level, not done per-row**. Future similar features (heatmap badges on `WorkoutDayCard`, stats overlays, achievements progress) should follow the same shape.

## Consequences

- **Positive:**
  - O(days_visible) Supabase queries instead of O(days_visible × exercises). Carousel mount goes from ~24 queries to ~3.
  - Reuses the well-tested client-side `computeNextSessionTarget` (covered by `src/lib/progression.test.ts`) — no SQL duplication.
  - The aggregator is pure data — RIR / near-failure detection logic stays in TypeScript where it's already tested.

- **Negative:**
  - One more hook to maintain alongside `useProgressionSuggestion`.
  - Slightly more wiring at the consuming component (suggestions arrive as a `Map` prop instead of a self-contained hook call inside the row).
  - Two ways to get a suggestion now exist (per-exercise vs per-day batch); newcomers need to know which to use. Mitigated by: the per-exercise variant is documented as in-session only, the batched one as list/pre-session.

- **Follow-ups:**
  - Implementation lives in #371 / its tech plan + tickets.
  - When a second per-row engine derivation feature ships (e.g. card-level "progression queued" badges), generalize the helper if and only if the shape repeats. **Don't pre-abstract.**
  - The deload / return-from-injury edge case (Builder edit of `weight` ignored because **Last Performance** wins) is **explicitly not addressed here** — same behavior as today, just made consistent across pre-session and in-session. Owns a separate future epic.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **A. One `useProgressionSuggestion` per row** | Up to ~24 parallel Supabase queries on carousel mount. Crado on mid-tier mobile, regresses Lighthouse numbers we just paid to fix. |
| **C. Postgres RPC `get_next_session_targets(exercise_ids[])`** | Duplicates the non-trivial `computeNextSessionTarget` logic in SQL (RIR averaging, near-failure detection, rule selection). Migration cost + ongoing dual-maintenance burden > value at current scale. Reconsider only if the client-side compute becomes the bottleneck (it won't). |
