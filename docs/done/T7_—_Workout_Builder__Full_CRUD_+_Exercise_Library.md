# T7 — Workout Builder: Full CRUD + Exercise Library

## Goal
Implement the `/builder` full-screen page for creating, editing, and deleting workout days and exercises. Replaces the hardcoded `WORKOUTS` constant from v1 with user-owned Supabase data.

## Scope

### Day List
- Fetch `workout_days` for the user via TanStack Query
- Render as tappable cards: day label, emoji, exercise count
- "+ New Day" button opens a blank day editor
- Long-press or swipe on a day card reveals delete option with shadcn `Dialog` confirmation

### Day Editor
- Day name field (editable)
- Ordered list of `workout_exercises` for the day
- Each exercise row: name, muscle, sets/reps/weight/rest — tapping opens `ExerciseDetailEditor`
- Drag handle for reordering (updates `sort_order`)
- Swipe-to-delete or trash icon per exercise row (with confirmation)
- "+ Add Exercise" button opens `ExerciseLibraryPicker`

### Exercise Library Picker
- Fetches all `exercises` from Supabase (system + user-created) via TanStack Query
- Searchable list: name, muscle group, emoji
- Tapping an exercise adds it to the current day: creates a `workout_exercises` row with snapshot fields (`name_snapshot`, `muscle_snapshot`, `emoji_snapshot`) copied from the library entry; `exercise_id` FK retained

### Exercise Detail Editor
- Edit sets, reps, weight, rest seconds for a `workout_exercises` row
- Changes auto-save via TanStack Query mutation with "Saved ✓" indicator

### Auto-save Behavior
- All mutations (create/update/delete day, add/remove/reorder exercise) trigger TanStack Query mutations immediately
- "Saved ✓" indicator in top bar on success
- On save failure: "Syncing failed" indicator; automatic retries when connectivity/availability restores

### Offline Block State
- If user opens Builder while offline: render full-screen block state with message "Internet required for editing"
- No editing controls are shown or accessible while offline

### Back Navigation
- Back arrow returns to `/`; updated workout programs are immediately reflected in `WorkoutScreen` (TanStack Query cache invalidation on Builder mutations)

## Out of Scope
- Offline queue for Builder mutations (Builder is online-only)
- Exercise library management (adding custom exercises to the library itself is not in v2 scope — users pick from the pre-seeded catalogue)

## Acceptance Criteria
- User can create a new workout day, add exercises from the library, edit sets/reps/weight/rest, reorder, and delete
- All changes persist to Supabase and are reflected immediately on the Workout screen after returning
- "Saved ✓" appears after each successful mutation; "Syncing failed" appears on failure
- Opening Builder while offline shows the full-screen block state with no editing controls
- Snapshot fields are correctly copied from the exercise library at add time

## References
- `spec:09100d04-cac9-490e-9368-d90a5492e210/ad32c727-9c73-4e3e-b56c-fa6bd3a02392` — Core Flows: Flow 6 (Workout Builder)
- `spec:09100d04-cac9-490e-9368-d90a5492e210/d02152ce-9bf5-42f9-b739-4d073216262f` — Tech Plan: `BuilderScreen`, `ExerciseLibraryPicker`, snapshot model, online-only constraint