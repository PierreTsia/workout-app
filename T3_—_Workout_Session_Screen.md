# T3 — Workout Session Screen

## Goal
Implement the full workout session experience at `/` — the primary surface of the app. This is a faithful React+TS rebuild of the v1 workout flow, now driven by Supabase data instead of hardcoded constants.

## Scope

### Data Loading
- Fetch `workout_days` + `workout_exercises` for the authenticated user via TanStack Query
- Fall back to the seeded system exercises if user has no custom programs yet

### Day Selector
- Render `DaySelector` component: horizontal scrollable pill list of workout days
- Selecting a day updates `sessionAtom.currentDayId` and resets exercise index

### Exercise Strip
- Render `ExerciseStrip`: horizontal scrollable thumbnails (emoji + name) for all exercises in the selected day
- Active exercise highlighted with teal border
- PR badge (`🏆`) shown on thumbnail if `prFlagsAtom[exerciseId] === true` for the session

### Exercise Detail + Sets Table
- Render current exercise name, muscle group
- `SetsTable`: editable rows (set number, reps input, weight input, done checkbox)
- Checking a set: marks row as done (teal), triggers rest timer, enqueues set log (via `SyncService` — T4)
- "Last time: 3 × 12 @ 40 kg" reference line below exercise name (TanStack Query fetch of last session's set for this exercise — hidden if no history)

### Rest Timer Overlay
- Full-screen overlay on set check
- Reads `restAtom.startedAt` + `restAtom.durationSeconds`; derives remaining time from `Date.now() - startedAt` on each tick
- Skip button dismisses overlay
- When app is backgrounded: timer continues via timestamp; schedules local notification/vibration when rest ends (requires notification permission from T2)
- On foreground return: shows correct remaining/elapsed state

### Session Navigation
- Previous / Next exercise buttons update `sessionAtom.exerciseIndex`
- On last exercise: "Next" becomes "Finish session"
- On "Finish session": if any planned sets are unchecked, show shadcn `Dialog` confirmation: "You have skipped sets — finish anyway?"
- On confirm: show `SessionSummary` screen (duration, sets done, exercises completed)

### Session State Persistence
- `sessionAtom` persisted to localStorage — page refresh mid-workout recovers full state
- Timer uses `startedAt` timestamp approach for accuracy across background/foreground

### Top Bar
- Session timer chip: derives elapsed from `sessionAtom.startedAt`
- Sync status chip: reads `syncStatusAtom` ("Offline" / "Syncing…" / "Synced" / "Sync failed")

## Out of Scope
- Offline queue implementation (T4 — `SyncService` is called here but implemented in T4)
- PR detection logic (T5 — `prFlagsAtom` is read here but written in T5)
- History/analytics (T6)
- Workout Builder (T7)

## Acceptance Criteria
- Full workout session can be completed end-to-end: select day → check all sets → finish session
- Rest timer overlay appears on set check and counts down correctly
- "Last time" reference line appears for exercises with prior history
- Skipped-sets confirmation dialog appears when finishing with unchecked sets
- Session state survives a page refresh mid-workout
- PR badge appears on exercise thumbnail when `prFlagsAtom` is set

## References
- `spec:09100d04-cac9-490e-9368-d90a5492e210/ad32c727-9c73-4e3e-b56c-fa6bd3a02392` — Core Flows: Flow 3 (Workout Session), Flow 8 (Offline), Session Persistence
- `spec:09100d04-cac9-490e-9368-d90a5492e210/d02152ce-9bf5-42f9-b739-4d073216262f` — Tech Plan: Component Architecture (`WorkoutScreen`, `SetsTable`, `RestTimerOverlay`)