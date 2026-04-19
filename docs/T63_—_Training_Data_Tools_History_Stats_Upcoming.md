# T63 — Training Data Tools: History, Stats, Upcoming

## Goal

Build the three data-heavy MCP tools that make coaching conversations possible: workout history, training stats, and upcoming workouts. These tools turn raw Supabase data into LLM-friendly structured text summaries. Also delivers the shared `lib/format.ts` formatter library used across all three.

## Dependencies

- T61 — MCP Server Scaffold + First Tool (provides `index.ts`, auth plumbing, tool registration pattern)

## Scope

### Shared formatters: `lib/format.ts`

| Function | Signature | Output |
|---|---|---|
| `formatDate` | `(date: string) => string` | ISO date + relative: "2026-04-15 (4 days ago)" |
| `formatWeight` | `(kg: number) => string` | Always kg (app stores kg-only per PRD): "72.5 kg" |
| `formatSessionSummary` | `(session, sets, exercises) => string` | Multi-line block: date, duration, exercise list with sets/reps/weight, PR flags |
| `formatStatsSummary` | `(volume, sessions, prs) => string` | Period summary: session count, total sets, volume by muscle, PRs achieved |
| `formatWorkoutDay` | `(day, exercises) => string` | Day label + emoji, exercise list with prescriptions (sets x reps @ weight) |

### Tool: `get_workout_history`

| Item | Detail |
|---|---|
| File | `supabase/functions/mcp/tools/getWorkoutHistory.ts` |
| Data source | Direct queries: `sessions` (filtered by date range) → `set_logs` (by session IDs) → `exercises` (by exercise IDs from set_logs) |
| Input schema | `from_date` (string, optional — ISO date), `to_date` (string, optional — ISO date, defaults to today), `exercise_name` (string, optional — filter sessions containing this exercise), `limit` (number, optional, default 10) |
| Query flow | 1. Fetch sessions for user in date range, ordered by `started_at` desc, limited. 2. Fetch set_logs for those session IDs. 3. Fetch exercise names for the exercise IDs in those set_logs. 4. Group sets by session, enrich with exercise names. |
| Output | Structured text via `formatSessionSummary` per session. Includes: date, duration, exercises done, sets/reps/weight per exercise, PR flags (`was_pr`). |
| Empty state | "No workout sessions found for this period. Start logging workouts in the app!" |
| Tool description | "Get your workout session history. Returns sessions with exercises, sets, reps, weights, and PR flags. Filter by date range or exercise name. Defaults to the last 10 sessions." |

### Tool: `get_training_stats`

| Item | Detail |
|---|---|
| File | `supabase/functions/mcp/tools/getTrainingStats.ts` |
| Data source | RPC: `get_volume_by_muscle_group` (volume breakdown) + direct queries: `sessions` (count, frequency), `set_logs` (PRs via `was_pr = true`) |
| Input schema | `days` (number, optional, default 30 — lookback period), `muscle_group` (string, optional — filter to specific muscle) |
| Query flow | 1. Call `get_volume_by_muscle_group` RPC with `days` and `offset_days = 0`. 2. Count sessions in the period. 3. Fetch PRs (`set_logs` where `was_pr = true`) in the period, join exercise names. 4. Combine into stats summary. |
| Output | Structured text via `formatStatsSummary`: total sessions, total sets, training frequency (sessions/week), volume breakdown by muscle group, list of PRs with exercise name + weight + date. |
| Empty state | "No training data found for the last N days." |
| Tool description | "Get training statistics for a period. Returns session count, training frequency, volume breakdown by muscle group, and personal records. Defaults to the last 30 days." |

### Tool: `get_upcoming_workouts`

| Item | Detail |
|---|---|
| File | `supabase/functions/mcp/tools/getUpcomingWorkouts.ts` |
| Data source | Direct queries: `programs` (active) → `cycles` (active, `finished_at IS NULL`) → `workout_days` (ordered by `sort_order`) → `workout_exercises` (with exercise snapshots) → `exercises` (for full names) |
| Input schema | `num_days` (number, optional, default 3 — how many upcoming days to show) |
| Query flow | 1. Find active program (where `is_active = true`). 2. Find active cycle. 3. Determine which workout day is next (compare completed sessions in the cycle against the ordered workout_days). 4. Fetch workout_exercises + exercise details for the next N days. |
| Output | Structured text via `formatWorkoutDay` per day: day label, exercise list with target sets/reps/weight, rest periods. |
| Empty state (no program) | "No active program found. Create one in the Workout Builder to see upcoming workouts." |
| Empty state (no cycle) | "No active training cycle. Start a new cycle from your program to see upcoming workouts." |
| Tool description | "See your upcoming programmed workouts. Returns the next training days with exercises, target sets, reps, and weights. Requires an active program and cycle." |

### Registration

Wire all three tools into `mcp/index.ts` alongside existing tools from T61 and T62.

## Out of Scope

- Write operations (log sets, create workouts) — Phase 3
- Domain expertise tools (suggest progression, calculate 1RM) — Phase 2
- Trend analysis (comparing current period vs. previous) — can be added as a follow-up tool
- OAuth 2.1 (T64)
- Production client testing (T65)

## Acceptance Criteria

- [ ] `tools/list` returns all 5 tools: `search_exercises`, `get_exercise_details`, `get_workout_history`, `get_training_stats`, `get_upcoming_workouts`
- [ ] `get_workout_history` with a date range returns session summaries with exercises, sets, and PR flags
- [ ] `get_workout_history` with no sessions in range returns a friendly empty-state message
- [ ] `get_training_stats` returns volume by muscle group, session count, frequency, and PRs
- [ ] `get_training_stats` with a `muscle_group` filter scopes results correctly
- [ ] `get_upcoming_workouts` returns the next N workout days with exercise prescriptions
- [ ] `get_upcoming_workouts` with no active program returns a clear guidance message
- [ ] All tool responses are structured text (not raw JSON), readable by an LLM agent
- [ ] All tools respond in < 3s locally (cold start excluded)

## References

- [Epic Brief — MCP-First Architecture (#231)](./Epic_Brief_—_MCP-First_Architecture_#231.md) — Scope: items 3a, 3c, 3d
- [Tech Plan — MCP-First Architecture (#231)](./Tech_Plan_—_MCP-First_Architecture_#231.md) — Sections: Tool-to-Query Mapping, Component Responsibilities (`lib/format.ts`), Failure Mode Analysis
- [T61 — MCP Server Scaffold + First Tool](./T61_—_MCP_Server_Scaffold_+_First_Tool.md)
