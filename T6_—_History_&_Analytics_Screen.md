# T6 — History & Analytics Screen

## Goal
Implement the `/history` screen with a summary dashboard, reverse-chronological session list, and per-exercise progression charts.

## Scope

### StatsDashboard Card
- Fetch and display: total sessions, total sets logged, total PRs set (`was_pr = true` count)
- Rendered as a summary card at the top of the screen

### Session List (default view)
- Reverse-chronological list of `sessions` rows via TanStack Query
- Each row: date, workout day label (`workout_label_snapshot`), duration, sets done
- Tapping a row expands it to show all `set_logs` for that session (exercise name, set number, reps, weight, 1RM)
- Read-only — no edit or delete actions

### By Exercise Tab (chart view)
- Searchable dropdown to select an exercise from the user's history
- Line chart (Recharts via shadcn chart primitives): weight over time (primary axis), reps over time (secondary)
- Below chart: raw historical sets table for the selected exercise (date, reps, weight, 1RM, PR flag)

### Navigation
- Back arrow in top-left returns to `/` (Workout screen)
- Session timer continues running throughout (reads `sessionAtom.startedAt` in `AppShell`)

### Tabs
- shadcn `Tabs` component: "Sessions" (default) | "By Exercise"

## Out of Scope
- Edit/delete of sessions (explicitly read-only in v2)
- Any mutation actions

## Acceptance Criteria
- Dashboard card shows correct totals matching Supabase data
- Session list renders in reverse-chronological order; expanding a row shows all sets
- "By Exercise" tab renders a Recharts line chart for the selected exercise
- Back arrow returns to `/` with session timer still running
- Screen loads with a TanStack Query loading state and handles empty state gracefully

## References
- `spec:09100d04-cac9-490e-9368-d90a5492e210/ad32c727-9c73-4e3e-b56c-fa6bd3a02392` — Core Flows: Flow 5 (History & Analytics)
- `spec:09100d04-cac9-490e-9368-d90a5492e210/d02152ce-9bf5-42f9-b739-4d073216262f` — Tech Plan: `HistoryScreen`, `StatsDashboard`, `ExerciseChart`, invalidation key groups