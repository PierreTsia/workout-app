# Observatory — Progression rules served

Working note, **not a spec**. Purpose: watch the rule the progression engine
actually served in-session, while deciding whether the plateau-exit work (P2 of
epic [#705](https://github.com/PierreTsia/workout-app/issues/705)) addresses a
real problem. Same pattern as `file:docs/Observatory_—_Deviations.md`: hand-run
SQL, aggregate only.

**Why an event and not a column.** The rule enum (`ProgressionRule`) is computed
client-side and persisted nowhere — only its *values* land in
`set_logs.prescribed_*`. So the only record of "which rule was served" is the
`progression_rule_served` event emitted by
`file:src/lib/progressionRuleTelemetry.ts`, one per slot and session.

**Privacy:** every query below is **aggregate only** — no `user_id`, no email.
Catalog / slot ids are fine; they are not people. Read-only.

---

## What we measure

Run these in the Supabase SQL editor. Three measures, in the order the epic lists
them.

### (a) Served-rule distribution — which rules actually fire?

```sql
select payload->>'rule' as rule, count(*) as n
from analytics_events
where event_type = 'progression_rule_served'
group by 1
order by n desc;
```

### (b) Consecutive `HOLD_INCOMPLETE` run length — how long do holds last?

Gaps-and-islands over the slot's event stream: two row numbers, the difference is
constant within a run of the same rule.

```sql
with e as (
  select
    payload->>'workoutExerciseId' as slot,
    payload->>'rule'              as rule,
    created_at
  from analytics_events
  where event_type = 'progression_rule_served'
),
runs as (
  select
    slot,
    rule,
    created_at,
    row_number() over (partition by slot order by created_at)
      - row_number() over (partition by slot, rule order by created_at) as run_id
  from e
)
select slot, count(*) as run_length, min(created_at) as started_at
from runs
where rule = 'HOLD_INCOMPLETE'
group by slot, run_id
having count(*) >= 2
order by run_length desc;
```

### (c) `PLATEAU` never resolved — the terminal state, still terminal?

Per slot, the most recent served rule; a slot stuck on `PLATEAU` is the signal
P2 would address.

```sql
with latest as (
  select distinct on (payload->>'workoutExerciseId')
    payload->>'workoutExerciseId' as slot,
    payload->>'rule'              as rule,
    created_at
  from analytics_events
  where event_type = 'progression_rule_served'
  order by payload->>'workoutExerciseId', created_at desc
)
select
  rule                       as latest_rule,
  count(*)                   as slots,
  max(created_at)            as most_recent
from latest
group by 1
order by slots desc;
```

**Reading it:** if `PLATEAU` never appears as a `latest_rule`, the plateau-exit
work solves a problem that does not occur in practice — and the epic's own
prerequisite says so. If it appears and never leaves, that is the case for P2.

---

## Notes

- One event per slot **per session**: a re-render does not double-count (the
  hook keys on `${sessionId}:${workoutExerciseId}`).
- No backfill: the event stream starts when the emit shipped. Pre-existing
  sessions have no rule history.
- The engine is client-only, so an offline session emits nothing for that slot.
  Absence is not a reading — the same rule as a gap in `set_logs`.
