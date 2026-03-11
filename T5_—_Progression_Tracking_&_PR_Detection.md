# T5 — Progression Tracking & PR Detection

## Goal
Implement inline "last session" references per exercise and real-time PR detection using the Epley 1RM formula. Wire the PR badge into the exercise strip.

## Scope

### Last Session Reference (inline)
- In `SetsTable`, fetch the most recent `set_logs` for the current `exercise_id` from the previous session via TanStack Query
- Display below the exercise name: *"Last time: 3 × 12 @ 40 kg"*
- Hidden if no prior history exists for that exercise

### PR Detection on Set Check
When a set is checked in `SetsTable`:
1. Compute estimated 1RM for the logged set using the **Epley formula**: `weight × (1 + reps / 30)`
2. Query TanStack Query cache (or Supabase) for all historical `set_logs.estimated_1rm` for the same `exercise_id`
3. If current 1RM > all historical values → new PR
4. Set `prFlagsAtom[exerciseId] = true` for the session
5. Store `estimated_1rm` and `was_pr = true` in the set log payload (written by `SyncService`)

### PR Badge on Exercise Strip
- `ExerciseStrip` reads `prFlagsAtom`; renders `🏆` badge on the exercise thumbnail when flag is set
- Badge persists for the entire session (not cleared between exercises)
- No interruption to the rest timer flow

### History Screen PR Count
- `StatsDashboard` (T6) queries total `was_pr = true` rows from `set_logs` for the user — this field is already stored, so no extra computation needed

## Out of Scope
- History screen rendering (T6)
- Offline queue (T4 — `SyncService` writes `estimated_1rm` and `was_pr` to the payload)

## Acceptance Criteria
- "Last time" reference appears for exercises with prior history; hidden for new exercises
- Completing a set that beats the historical best 1RM sets the `🏆` badge on the exercise thumbnail
- `was_pr = true` is stored in `set_logs` for the PR set
- Completing a set that does not beat the best 1RM does not set the badge
- Epley formula is used consistently: `weight × (1 + reps / 30)`

## References
- `spec:09100d04-cac9-490e-9368-d90a5492e210/d02152ce-9bf5-42f9-b739-4d073216262f` — Tech Plan: PR detection (compute on the fly), `SetsTable`, `prFlagsAtom`
- `spec:09100d04-cac9-490e-9368-d90a5492e210/ad32c727-9c73-4e3e-b56c-fa6bd3a02392` — Core Flows: Flow 3 (PR badge on strip)