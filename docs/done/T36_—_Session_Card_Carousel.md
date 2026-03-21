# T36 — Session Card Carousel

## Goal

Replace the pre-session workout view (DaySelector + SessionHeatmap + ExerciseStrip + ExerciseDetail) with a swipeable carousel of day cards. Each card shows the day's exercises, body map, stats, last session info, and a Start CTA. This is the core visual refactor of the main screen.

## Dependencies

- T35 — Cycle Lifecycle Logic (cycle hooks must be available for status badges and progress)

## Scope

### Install shadcn/ui Carousel

- `npx shadcn@latest add carousel` → generates `src/components/ui/carousel.tsx` + installs `embla-carousel-react`

### WorkoutDayCarousel

Create `file:src/components/workout/WorkoutDayCarousel.tsx`:

- Wraps `Carousel` + `CarouselContent` + `CarouselItem`
- Tracks `slidesInView` via Embla API, passes `isVisible` to cards
- Auto-scrolls to `nextDayId` from `useCycleProgress` on mount
- Renders `WorkoutDayCard` per day

### WorkoutDayCard

Create `file:src/components/workout/WorkoutDayCard.tsx`:

- Props: `day`, `cycleId`, `isCompleted`, `isNext`, `isVisible`
- Conditional fetch: `useWorkoutExercises(isVisible ? day.id : null)`
- Status badge (Completed/Next/none)
- Day emoji + label header
- `BodyMap` (aggregated, always visible via `useAggregatedMuscles`)
- Stats row: estimated duration, total set count
- Last session block via `useLastSessionForDay`
- Exercise list via `ExerciseListPreview`
- Floating "Start Workout" CTA (`position: sticky; bottom: 0`)
- Completed state: muted card with "Reset day" action (wired in T37)

### ExerciseListPreview

Create `file:src/components/workout/ExerciseListPreview.tsx`:

- Compact exercise rows: `ExerciseThumbnail` (32px), name, equipment badge, sets × reps × weight
- Purely informational — no interactivity

### useLastSessionForDay

Create `file:src/hooks/useLastSessionForDay.ts`:

- Query key: `["last-session-day", dayId, cycleId ?? "any"]`
- Queries most recent finished session for a day, optionally scoped to cycle
- Falls back to unscoped query when no cycle-scoped match

### WorkoutPage integration

In `file:src/pages/WorkoutPage.tsx`:

- Replace `DaySelector` + `SessionHeatmap` + `ExerciseStrip` + `ExerciseDetail` in pre-session view with `WorkoutDayCarousel`
- Keep in-session view (ExerciseStrip, ExerciseDetail, SessionNav) unchanged
- Wire "Start Workout" from card CTA through existing `handleStartWorkout`

### i18n (card content)

Add keys: `estimatedDuration`, `neverDone`, `lastSessionOn`, `nextWorkout`, `completed`, `startWorkout` (if not existing)

## Out of Scope

- CycleProgressHeader (T37)
- CycleCompleteBanner (T37)
- Reset day action logic (T37)
- QuickWorkoutCard (T37)
- "Finish rotation" menu (T37)

## Acceptance Criteria

- [ ] Carousel renders one card per workout day, swipeable on mobile
- [ ] Auto-scrolls to the next incomplete day on mount
- [ ] Only active + next neighbor cards fetch exercises (lazy loading)
- [ ] Each card shows: status badge, body map, stats, exercise list, last session info
- [ ] "Start Workout" CTA is sticky at viewport bottom, starts a session for that day
- [ ] Completed days show muted state
- [ ] In-session view is unchanged (ExerciseStrip, ExerciseDetail, SessionNav)
- [ ] On a 390px viewport, cards are readable without overflow or truncation
- [ ] `npm run build` succeeds, existing tests pass

## References

- [Epic Brief](docs/Epic_Brief_—_Workout_Overview_Session_Cards.md) — PR B items 7-10, 12
- [Tech Plan](docs/Tech_Plan_—_Workout_Overview_Session_Cards.md) — PR B sections (carousel, card, exercise list, last session, view transition)
