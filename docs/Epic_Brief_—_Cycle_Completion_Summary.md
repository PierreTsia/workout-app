# Epic Brief — Cycle Completion Summary

## Summary

Replace the minimal inline "Cycle terminé!" banner with a dedicated cycle summary page (`/cycle-summary/:cycleId`) shown when a user completes all days in a training cycle. The page displays aggregate stats — sessions completed, total training time, total volume, sets done, PRs hit, date range, and consistency — with comparison deltas against the previous cycle. A Supabase RPC function (`get_cycle_stats`) powers the aggregation server-side to keep the client lean. This turns cycle completion from a dismissible one-liner into a rewarding milestone moment with actionable data.

---

## Context & Problem

**Who is affected:** Every user who finishes a training cycle (completes all workout days in a rotation).

**Current state:**
- `file:src/components/workout/CycleCompleteBanner.tsx` renders a one-line emerald banner with a PartyPopper icon and a "Start new cycle" button — no stats, no celebration, no data
- Tapping "Start new cycle" immediately sets `finished_at` on the cycle via `handleFinishCycle` in `file:src/pages/WorkoutPage.tsx` and resets — the user gets zero feedback on what they accomplished
- All the data needed for a rich summary already exists: `sessions` has duration and sets, `set_logs` has weight/reps/PR flags, `cycles` has date range — but there is no aggregation layer
- No volume calculation exists anywhere in the codebase (`file:src/lib/sessionSummary.ts` groups by exercise but computes no totals)
- The per-session `SessionSummary` (`file:src/components/workout/SessionSummary.tsx`) shows duration, sets, and PR badges — but only for a single session, never at the cycle level
- Completing a cycle is the biggest milestone in the app, yet it gets less visual treatment than finishing a single session

**Pain points:**

| Pain | Impact |
|---|---|
| Cycle completion banner has no stats | Users can't see what they achieved across the cycle — no volume, no PRs, no duration |
| No cycle-over-cycle comparison | Users have no sense of progression between rotations |
| Instant cycle reset on tap | No moment to pause and reflect; the completion event is over in one tap |
| No shareable/revisitable summary | Users can't come back to review a past cycle's results (the banner disappears forever) |

---

## Goals

| Goal | Measure |
|---|---|
| Rewarding cycle completion moment | Full-page summary with 7 aggregate stats replaces the one-line banner |
| Server-side aggregation | A single Supabase RPC call returns all stats — no client-side waterfall or N+1 queries |
| Cycle-over-cycle comparison | Delta percentages (volume, sets, PRs) shown when a previous cycle exists for the same program |
| Bookmarkable summary page | `/cycle-summary/:cycleId` route works on direct navigation and browser refresh |
| Graceful first-cycle state | When no previous cycle exists, the page shows absolute stats with a "First cycle!" celebration — no broken comparison UI |
| Smooth transition into new cycle | "Start new cycle" on the summary page finalizes the cycle and navigates back to the carousel |

---

## Scope

**In scope:**

1. **Supabase RPC `get_cycle_stats`** — A Postgres function that accepts `p_cycle_id uuid` and `p_previous_cycle_id uuid DEFAULT NULL`. Returns a single JSON row with:
   - `session_count` / `session_total` — finished sessions vs. total days in the program
   - `total_duration_ms` — `SUM(finished_at - started_at)` across cycle sessions
   - `total_sets` — `SUM(total_sets_done)` across cycle sessions
   - `total_volume_kg` — `SUM(weight_logged * reps_logged::int)` from `set_logs` joined to cycle sessions (`reps_logged` is `text` — the cast must handle non-numeric values gracefully via `NULLIF` or a safe-cast wrapper)
   - `pr_count` — `COUNT(*)` from `set_logs` where `was_pr = true` joined to cycle sessions
   - `started_at` / `finished_at` — cycle date range
   - `duration_days` — calendar days from cycle start to last session finish
   - When `p_previous_cycle_id` is provided: `delta_volume_pct`, `delta_sets_pct`, `delta_prs_pct` comparing current vs. previous

2. **Migration** — New SQL migration creating the `get_cycle_stats` function. No schema changes needed — all underlying tables (`cycles`, `sessions`, `set_logs`) already exist.

3. **`usePreviousCycle(programId, currentCycleId)` hook** — Fetches the most recent finished cycle for the same program that isn't the current one. Returns its `id` for passing to the RPC.

4. **`useCycleStats(cycleId, previousCycleId?)` hook** — Wraps the `get_cycle_stats` RPC call via `supabase.rpc()`. TanStack Query key: `["cycle-stats", cycleId]`.

5. **`/cycle-summary/:cycleId` route** — New page component `CycleSummaryPage`:
   - Hero section: trophy/celebration visual, "Cycle Complete" heading, date range subtitle
   - Stats grid: sessions, duration, sets, volume, PRs, consistency — each as a card with icon, value, label, and optional delta badge (green ↑ / red ↓ / neutral)
   - Comparison callout: "vs. previous cycle" context when deltas are available, "First cycle — keep going!" when not
   - "Start new cycle" primary CTA — calls `handleFinishCycle` then navigates to `/`
   - "Back to workouts" secondary link — navigates to `/` without finalizing (cycle stays open)

6. **Update `SessionSummary` for cycle-complete detection** — When the just-finished session completes the cycle (check `cycleProgress.isComplete` after session finish), show a "Cycle complete!" badge on the `SessionSummary`. Change the "New Session" button label to "View Cycle Summary" and navigate to `/cycle-summary/:cycleId` instead of resetting.

7. **Update `WorkoutPage` flow** — Remove the `CycleCompleteBanner` rendering. The cycle-complete state now routes to the summary page instead of showing an inline banner. `handleFinishCycle` moves to `CycleSummaryPage` (or a shared utility).

8. **i18n keys** — New keys in `workout` namespace: `cycleSummary.title`, `cycleSummary.sessions`, `cycleSummary.duration`, `cycleSummary.sets`, `cycleSummary.volume`, `cycleSummary.prs`, `cycleSummary.consistency`, `cycleSummary.firstCycle`, `cycleSummary.vsPrevious`, `cycleSummary.startNewCycle`, `cycleSummary.backToWorkouts`, `cycleSummary.cycleCompleteBadge`.

9. **Router update** — Add `/cycle-summary/:cycleId` to the app router (likely in `file:src/App.tsx` or equivalent route config).

10. **Remove or deprecate `CycleCompleteBanner`** — The inline banner is replaced by the route-based summary. Can be deleted or kept as a fallback for edge cases (e.g. offline with no route access).

**Out of scope:**

- Calorie estimation (no calorie data tracked)
- Social sharing of cycle stats
- Cycle history list page (viewing all past cycle summaries in `/history`)
- Exercise-level breakdown within the summary (per-exercise volume chart, per-exercise PR list)
- Animated confetti or celebration effects (could be a fast follow-up)
- Active session UX changes — the in-session flow is untouched

---

## Success Criteria

- **Numeric:** Summary page loads all stats within 1 second via a single RPC call — no client-side waterfall.
- **Numeric:** All 7 proposed stats displayed: sessions completed, total duration, total sets, total volume (kg), PR count, date range, consistency (days to complete).
- **Numeric:** Comparison deltas (volume, sets, PRs) are accurate to within 1% of manual calculation from raw `set_logs` data.
- **Qualitative:** When no previous cycle exists, the page shows a coherent "First cycle" state — no empty delta badges, no broken UI.
- **Qualitative:** `/cycle-summary/:cycleId` works on direct URL access (browser refresh, shared link) — the page fetches its own data without depending on in-memory state.
- **Qualitative:** On a 390px viewport, all stat cards are readable without horizontal overflow or truncation.

---

## Resolved decisions

1. **Aggregation strategy** — Supabase RPC (Postgres function) rather than client-side aggregation. The RPC does all joins and math in one round-trip. This avoids fetching potentially hundreds of `set_logs` rows to the client.
2. **Comparison scope** — Basic deltas (volume, sets, PRs) vs. the immediately previous finished cycle for the same program. No historical trend lines or multi-cycle charts.
3. **UX container** — Dedicated route (`/cycle-summary/:cycleId`) rather than a bottom sheet or inline expansion. This gives us a bookmarkable URL and enough screen real estate for a stats-rich layout.
4. **Trigger flow** — `SessionSummary` of the last cycle session shows a badge and navigates to the summary page on "New Session" tap. The inline `CycleCompleteBanner` is removed from the carousel.
5. **Cycle finalization** — Happens on the summary page when the user taps "Start new cycle", not inline. "Back to workouts" keeps the cycle open (unconfirmed), matching the existing dismiss behavior.

---

## Dependencies & risks

- **Workout Overview Session Cards (#80)** — The cycle model (`cycles` table, `sessions.cycle_id`, `useActiveCycle`, `useCycleProgress`) must be merged. Currently on `main`.
- **`set_logs.was_pr`** — PR detection per set is already shipped and synced. Aggregation depends on this column being reliably populated.
- **`set_logs.weight_logged` / `reps_logged`** — Volume calculation depends on these being numeric and non-null for logged sets. Need to handle potential null/zero edge cases in the RPC.
- **Router setup** — Adding a new route requires understanding the current routing configuration and auth guards.
- **Offline behavior** — The RPC call requires network. If the user finishes a cycle offline, the summary page won't load until reconnected. The `SessionSummary` badge should still appear (derived from local cycle progress state), with the summary page available once back online.

---

## Deferred to Tech Plan

1. **RPC function SQL** — Exact Postgres function body, parameter types, return type, and edge case handling (empty cycles, null weights, zero-rep sets).
2. **Component architecture** — `CycleSummaryPage` internal structure, stat card component, delta badge component.
3. **Router integration** — How the new route fits into existing auth guards and layout wrappers.
4. **Offline fallback** — Whether to show a skeleton, cached data, or redirect when offline.
5. **Migration strategy** — Whether to use `CREATE OR REPLACE FUNCTION` or a versioned migration.

When ready, say **create tech plan** to continue.
