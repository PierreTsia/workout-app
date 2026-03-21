# T38 — Cycle Stats RPC, Hooks & Types

## Goal

Ship the data layer for the cycle completion summary: a Supabase RPC function that aggregates cycle-level stats (sessions, duration, volume, sets, PRs, deltas vs. previous cycle) in a single call, plus the React hooks and TypeScript types that consume it. After this ticket, the frontend has everything it needs to render the summary page — no UI changes yet.

## Dependencies

None. All underlying tables (`cycles`, `sessions`, `set_logs`) already exist on `main`.

## Scope

### Migration — `get_cycle_stats` RPC

New migration file: `supabase/migrations/YYYYMMDDHHMMSS_create_get_cycle_stats.sql`

Create a `plpgsql` function matching the spec in the Tech Plan:

| Parameter | Type | Default |
|---|---|---|
| `p_cycle_id` | `uuid` | required |
| `p_previous_cycle_id` | `uuid` | `NULL` |

**Returns** a single JSON object:

| Field | Type | Source |
|---|---|---|
| `session_count` | `int` | `COUNT(sessions)` where `cycle_id` and `finished_at IS NOT NULL` |
| `total_duration_ms` | `bigint` | `SUM(finished_at - started_at)` in ms |
| `total_sets` | `int` | `SUM(total_sets_done)` |
| `total_volume_kg` | `numeric` | `SUM(weight_logged * reps_logged::int)` from `set_logs` |
| `pr_count` | `int` | `COUNT(*) FILTER (WHERE was_pr)` from `set_logs` |
| `started_at` | `timestamptz` | `cycles.started_at` |
| `last_finished_at` | `timestamptz` | `MAX(sessions.finished_at)` |
| `duration_days` | `int` | Calendar days from start to last finish, min 1 |
| `delta_volume_pct` | `numeric | null` | Only when `p_previous_cycle_id` provided |
| `delta_sets_pct` | `numeric | null` | Only when `p_previous_cycle_id` provided |
| `delta_prs_pct` | `numeric | null` | Only when `p_previous_cycle_id` provided |

Edge cases handled in the RPC:
- `reps_logged` is `text` — filter with `WHERE reps_logged ~ '^\d+$'` before casting
- Cycle not found → return `{ "error": "cycle_not_found" }`
- Zero sessions → return zeroes, not NULL
- Previous cycle with zero volume/sets/PRs → delta is `NULL` (no division by zero)

Function attributes: `STABLE`, `SECURITY DEFINER`, `SET search_path = public`.

Reference SQL: Tech Plan → Data Model → RPC: `get_cycle_stats`

### TypeScript type — `CycleStats`

Add to `file:src/types/database.ts`:

```typescript
export interface CycleStats {
  session_count: number
  total_duration_ms: number
  total_sets: number
  total_volume_kg: number
  pr_count: number
  started_at: string
  last_finished_at: string | null
  duration_days: number
  delta_volume_pct: number | null
  delta_sets_pct: number | null
  delta_prs_pct: number | null
}
```

### Hook — `useCycleStats`

New file: `file:src/hooks/useCycleStats.ts`

- Wraps `supabase.rpc("get_cycle_stats", { p_cycle_id, p_previous_cycle_id })`
- Query key: `["cycle-stats", cycleId]`
- `enabled: !!cycleId`
- Returns `CycleStats | null`

### Hook — `usePreviousCycle`

New file: `file:src/hooks/usePreviousCycle.ts`

- Queries `cycles` where `program_id = ?`, `finished_at IS NOT NULL`, `id != currentCycleId`
- Ordered by `finished_at DESC`, limit 1
- Query key: `["previous-cycle", programId, currentCycleId]`
- `enabled: !!programId && !!currentCycleId`
- Returns `Cycle | null`

### Hook — `useFinishCycle`

New file: `file:src/hooks/useFinishCycle.ts`

- `useMutation` that updates `cycles.finished_at = now()` for a given `cycleId`
- `onSuccess`: invalidates `["active-cycle"]` and `["cycle-sessions"]`
- Idempotent — re-finishing an already-finished cycle is harmless

## Out of Scope

- `CycleSummaryPage` component and route — T39
- `SessionSummary` integration (cycle-complete badge, navigation) — T39
- `CycleCompleteBanner` deletion — T39
- i18n keys — T39

## Acceptance Criteria

- [ ] Migration applies cleanly: `get_cycle_stats` function exists in Supabase
- [ ] RPC returns correct stats for a cycle with finished sessions (manual verification or integration test)
- [ ] RPC returns zeroes (not errors) for a cycle with zero finished sessions
- [ ] RPC returns `NULL` deltas when `p_previous_cycle_id` is `NULL`
- [ ] RPC returns percentage deltas when `p_previous_cycle_id` points to a valid finished cycle
- [ ] `reps_logged` with non-numeric values are excluded from volume calculation (no cast errors)
- [ ] `CycleStats` type exported from `file:src/types/database.ts`
- [ ] `useCycleStats`, `usePreviousCycle`, `useFinishCycle` hooks exported and callable
- [ ] Build passes (`npm run build`)

## References

- [Epic Brief — Cycle Completion Summary](docs/Epic_Brief_—_Cycle_Completion_Summary.md)
- [Tech Plan — Cycle Completion Summary](docs/Tech_Plan_—_Cycle_Completion_Summary.md) → Data Model, Component Responsibilities
