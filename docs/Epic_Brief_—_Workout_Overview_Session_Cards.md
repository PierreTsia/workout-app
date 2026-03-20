# Epic Brief — Workout Overview Session Cards + Training Cycles

## Summary

Replace the pre-start workout main screen with a horizontally swipeable carousel of session cards, powered by a new Training Cycle model. Each card represents a workout day and shows its cycle status (completed/next/pending), a body map heatmap, estimated duration and set count, a full exercise list preview, and a Start CTA. A cycle groups one rotation through all program days — when every day has a finished session, the cycle is complete and a new one begins. This gives users an at-a-glance overview of their program, clear "what's next" guidance, and rotation-level progress tracking (e.g. "2/3 done").

---

## Context & Problem

**Who is affected:** Every user landing on the main workout screen (the most-visited page in the app).

**Current state:**
- `file:src/components/workout/DaySelector.tsx` renders workout days as small pill tabs in a horizontal scroll
- Selecting a day loads exercises into `file:src/components/workout/ExerciseStrip.tsx` (tiny thumbnail chips) and shows one exercise at a time in `file:src/components/workout/ExerciseDetail.tsx`
- The user must tap through exercises one by one to understand what a day contains
- Last session info (date, duration, sets) is only available on `/history` — never on the main screen
- The body map (`SessionHeatmap`) was just added but is collapsed by default and easy to miss
- Sessions are recorded with timestamps and `workout_day_id`, but there's no concept tying them into a rotation — users mentally track which days they've done

**Pain points:**

| Pain | Impact |
|---|---|
| Pill tabs show only day names — zero preview of what a day contains | Users must tap into a day to understand its exercises |
| ExerciseStrip shows tiny thumbnails — not readable on mobile | Users can't scan exercises at a glance |
| Single ExerciseDetail view before starting | Requires N taps to review N exercises |
| No last session context on main screen | Users forget when they last did a day and what weights they used |
| Body map collapsed by default | The heatmap (just shipped) is invisible unless manually expanded |
| No rotation/cycle tracking | Users must mentally track which days they've done this rotation; no "what's next" guidance or completion signal |

---

## Goals

| Goal | Measure |
|---|---|
| At-a-glance session overview | A user can name every exercise in a day, see the muscle map, and know when they last did it — without any taps beyond swiping |
| Faster time-to-start | Taps to start a session from cold launch is reduced (swipe to day, tap Start — 2 interactions max) |
| Cycle progress tracking | A progress indicator (e.g. "2/3 done") shows how many days are completed in the current rotation |
| Auto-advance to next workout | The carousel auto-scrolls to the first incomplete day in the current cycle on mount |
| Visual richness | Body map, exercise thumbnails, equipment, sets/reps/weight, and cycle status badges visible on each card |
| Zero regression on active session | The in-session flow (ExerciseStrip, ExerciseDetail, SetsTable, SessionNav) is untouched |

---

## Scope

**In scope:**

### A. Training Cycle model

1. **`cycles` table** — New Supabase table: `id` (uuid PK), `program_id` (FK), `user_id` (FK), `started_at` (timestamp), `finished_at` (timestamp, nullable). RLS: users can only read/write their own cycles. One active (unfinished) cycle per program at a time.

2. **`sessions.cycle_id`** — New nullable FK column on `sessions`. When a session starts, it's linked to the active cycle. Quick workout sessions have `cycle_id = null` (they live outside the rotation).

3. **Cycle lifecycle:**
   - **Auto-start:** When the user taps "Start Workout" on any day and no active cycle exists for the program, a new cycle is created automatically. No manual "start week" action needed.
   - **Auto-finish:** When the last incomplete day in a cycle gets a finished session, the cycle's `finished_at` is set. A brief celebration toast appears ("Rotation complete!").
   - **Manual finish:** A "Finish rotation" action in the carousel header lets users close a cycle early (e.g. skipping a day they want to defer). Non-destructive — it just sets `finished_at`.
   - **Cancel a day:** Users can "cancel" a completed day within the current cycle — this unlinks the session from the cycle (sets `session.cycle_id = null`), turning the day card back to pending. The session record is preserved in history.
   - **New cycle after finish:** Next time the user taps "Start Workout" on any day, a fresh cycle starts (back to rule 1).

4. **`useActiveCycle(programId)` hook** — Fetches the current unfinished cycle for a program, including which days have completed sessions within it.

5. **`useCycleProgress(cycleId, days)` hook** — Derives `{ completedDayIds: string[], totalDays: number, nextDayId: string | null }` from the active cycle's sessions.

### B. Session card carousel

6. **Swipeable day card carousel** — Replace `DaySelector` pills with a full-width horizontal carousel (Embla Carousel via shadcn/ui `Carousel` component). Each card is a `WorkoutDayCard`. Progress indicator below (filled dots for completed days, empty for pending). Auto-scrolls to the next incomplete day on mount.

7. **`WorkoutDayCard` component** — A card per workout day showing:
   - Status badge: "Completed" (done in current cycle, with checkmark), "Next" (auto-suggested), or no badge (pending)
   - Day emoji + label as header
   - Body map heatmap (reuse `BodyMap` + `useAggregatedMuscles` from #77, always visible — not collapsible)
   - Stats row: estimated duration (exercises x sets x avg rest), total set count
   - Last session block: date + duration + sets from the most recent session for this day in the current cycle (or "Never done" on first cycle)
   - Exercise list: all exercises with thumbnail, name, equipment badge, sets x reps x weight
   - "Start Workout" floating CTA — sticky at the bottom of the card viewport, always reachable as the exercise list expands. Hidden on completed days (replaced by muted "Completed" state with a "Cancel day" action).

8. **`useLastSessionForDay(dayId, cycleId?)` hook** — New Supabase query: fetch the most recent finished session for a day, optionally scoped to the current cycle.

9. **Exercise list per day** — Each card fetches exercises via `useWorkoutExercises(dayId)`. Fetch strategy: active card + the next peeking neighbor only (2 cards hydrated at a time). Others load on swipe. TanStack Query caching means revisited cards don't re-fetch.

10. **Quick Workout entry point** — Move from `DaySelector` to a trailing card in the carousel (distinctive style — dashed border, Zap icon). Tapping opens `QuickWorkoutSheet`. Quick workouts don't participate in cycles.

11. **Transition to active session** — "Start Workout" resolves or creates the active cycle (getting its ID), stores `cycleId` in the Jotai session atom, collapses the carousel, and switches to the existing in-session layout. The `cycle_id` is written to Supabase at session finish time (via `enqueueSessionFinish` in `file:src/pages/WorkoutPage.tsx`), not at start — matching the existing offline-first session write pattern. After finishing, carousel reappears with updated cycle progress.

12. **Cycle progress header** — Above the carousel, a compact bar: program name + "2/3 done" progress indicator (filled/empty dots matching day cards). "Finish rotation" action available via three-dot menu.

13. **i18n** — New keys: cycle status labels, progress text, "Finish rotation", "Rotation complete!", estimated duration, "Never done", "Cancel day".

**Out of scope:**

- Active session UX changes (ExerciseStrip, ExerciseDetail, SetsTable, SessionNav, RestTimer) — stays as-is
- Session summary changes — stays as-is (but now writes `cycle_id` on the session)
- Cycle history view ("Week 12: Push, Pull, Legs — 2h47") — follow-up epic for history page integration
- Cross-cycle progression analytics (week-over-week load comparison) — follow-up
- 3D exercise illustrations — we keep current thumbnails
- Exercise swap/history actions from the overview card — only during active session

---

## Success Criteria

- **Numeric:** Pre-start overview loads all day cards (exercises + cycle progress) within 2 seconds on a warm cache. Lighthouse performance on `/` does not regress by more than 5 points.
- **Numeric:** Cycle progress updates within 1 second after a session finishes (optimistic update or query invalidation).
- **Qualitative:** A user can identify every exercise, its load, the cycle status of each day, and overall rotation progress by swiping — zero taps required beyond navigation.
- **Qualitative:** On a 390px viewport, cards are readable and scrollable without horizontal overflow or text truncation on exercise names.
- **Qualitative:** The "next workout" auto-advance correctly selects the first incomplete day in sort order.

---

## Resolved decisions

1. **Exercise fetch strategy** — Active card + next peeking neighbor only (2 cards). Others load on swipe. TanStack Query cache handles revisits.
2. **Card scroll behavior** — Cards expand to fit all exercises (no internal scroll). The "Start Workout" CTA floats at the bottom of the viewport so it stays reachable regardless of list length.
3. **Redo semantics** — No redo within the same cycle. Users can "cancel" a completed day (unlink session from cycle) to revert it to pending, then start a fresh session for that day.
4. **Program changes mid-cycle** — Cycle tracks sessions by `workout_day_id`. Adding a day means one more to complete; removing a day doesn't invalidate existing sessions. Cycle completion check is always computed against the current program days.

---

## Dependencies & risks

- **Body Highlight Visualization (#77)** — `BodyMap`, `useAggregatedMuscles`, and `muscleMapping` — merged to main.
- **shadcn/ui Carousel** — needs to be installed (`npx shadcn@latest add carousel`), pulls in `embla-carousel-react`.
- **Supabase migration** — new `cycles` table + `sessions.cycle_id` column. Migration must be backwards-compatible (nullable FK, no breaking changes to existing session writes).

---

## Open questions (for Tech Plan)

1. **Floating CTA implementation** — CSS `sticky` within the card, or a portal-based overlay anchored to the viewport bottom? Needs to play well with the carousel's scroll/swipe mechanics.
2. **Cancel day confirmation** — Should "Cancel day" require a confirmation dialog, or is a single tap with an undo toast sufficient?

When ready, say **create tech plan** to continue.
