# Observatory — Deviations

Working note, **not a spec**. Purpose: watch `session_deviation_events` while the
sample is too thin to justify a load-management refactor, and pin down **how we
will read it** the day it isn't. No engine change yet (T266 shipped the capture,
T267 the session note; the recap's deviation section was removed by #665; ADR `file:docs/adr/0026-deviation-storage.md`).

**Privacy:** every query below is **aggregate only** — no `user_id`, no email,
no `note` content. Catalog ids (`exercise_id`) are fine; they are not people.
Read-only.

**Semantics change (#638, 2026-10-04):** `session_deviation_events` now holds **one
row per load decision**, not per set — a run of consecutive sets at the same load
prompts once and writes one event. Raw event counts (and the 30-event run #1
baseline) are therefore **not comparable** across the boundary; the per-session
rate and the tap-adoption share stay comparable. Start a new run boundary here.

## What we measure

Run these in the Supabase SQL editor (project `favusepjqwpcroiolvaz`). The first
two are the vital signs; the rest only once they have volume.

### 1. Daily volume — is capture alive and growing?

```sql
select
  date_trunc('day', created_at)::date as day,
  count(*)                                  as events,
  count(distinct session_id)                as sessions,
  count(*) filter (where reason_code is null) as skipped,
  count(*) filter (where note is not null)    as with_note
from session_deviation_events
group by 1
order by 1 desc;
```

### 2. Reason distribution — which buttons get used?

```sql
select coalesce(reason_code, '(skipped)') as reason, count(*) as n
from session_deviation_events
group by 1
order by n desc;
```

### 3. Direction × reason — the signal that matters

Join back to `set_logs` by the identity the event references (ADR 0026 — the
event stores no numbers).

A deviation is weight **or** reps (`isLoadDeviation`, `file:src/lib/deviationCapture.ts`),
so direction falls back to reps when the weight is unchanged.

```sql
with d as (
  select
    sde.reason_code,
    sl.prescribed_weight,
    sl.weight_logged,
    case when sl.reps_logged ~ '^\s*\d+\s*$'
         then sl.reps_logged::numeric end as reps_logged,
    sl.prescribed_reps::numeric as prescribed_reps
  from session_deviation_events sde
  join set_logs sl
    on sl.session_id          = sde.session_id
   and sl.workout_exercise_id = sde.workout_exercise_id
   and sl.set_number          = sde.set_number
)
select
  case
    when prescribed_weight is null then 'no_prescription'
    when weight_logged > prescribed_weight then 'over'
    when weight_logged < prescribed_weight then 'under'
    when reps_logged is not null and prescribed_reps is not null
         and reps_logged <> prescribed_reps
      then case when reps_logged > prescribed_reps then 'over' else 'under' end
    else 'flat'
  end as direction,
  coalesce(reason_code, '(skipped)') as reason,
  count(*) as n
from d
group by 1, 2
order by 1, 3 desc;
```

`no_prescription` = rows with no Prescription Snapshot (legacy / bootstrap) —
exclude from interpretation, they are not deviations against intent. `flat`
with a reason is unexpected (a deviation row whose numbers match): treat as a
data smell, not a reading.

### 4. Deviation rate — is overshoot systemic or occasional?

```sql
select
  e.day,
  e.events,
  s.sets,
  round(100.0 * e.events / nullif(s.sets, 0), 1) as pct_deviated
from (select date_trunc('day', created_at)::date as day, count(*) as events
      from session_deviation_events group by 1) e
left join (select date_trunc('day', logged_at)::date as day, count(*) as sets
           from set_logs group by 1) s using (day)
order by e.day desc;
```

### 5. Concentration by exercise — a few slots or everything?

Catalog-level, no athlete identity.

```sql
select
  sde.exercise_id,
  count(*)                             as events,
  count(distinct sde.workout_exercise_id) as slots,
  count(distinct sde.session_id)          as sessions
from session_deviation_events sde
group by 1
order by events desc
limit 20;
```

## How we will read it

Working grid. Rows are filled by queries 3 + 5. The **effect** column is the
future engine behavior, not built yet.

| Reason (× direction) | Reading | Proposed effect on next prescription |
|---|---|---|
| `strong` + over | prescription too conservative for that slot | anchor on the **actual**, progress (`WEIGHT_UP` / larger increment) |
| `strong` + under | rare; felt strong but dropped load | ignore for progression, flag for review |
| `fatigue` + under | daily capacity, not the load target | `HOLD`, do not pull the anchor down |
| `pain` + under | safety / technique, not progression | `HOLD`/deload + tag; **never** a failed-session penalty |
| `form` + under | execution, not capability | `HOLD`, no anchor move |
| `equipment` + under | external constraint | ignore for load progression |
| *(skipped)* | ambiguous on purpose — missing why is data | neutral; low confidence, never sole trigger |

**Anchor rule (target of the refactor):** baseline = Prescription Snapshot,
**except** when the deviation is capability-driven (`strong` + over) → the actual
wins. This is the one change that turns the *why* into a progression signal.

## Guardrails (hold before any refactor)

- **Minimum sample per slot** before a reason gates a rule (threshold: see Open
  question 1).
- `reason_code` nullable → its absence is a weak signal, never a hard trigger.
- `pain` is health-adjacent: captured and shown as a chip, but it must not drive
  an automated load penalty — route to safety handling, never a progression rule.
- **Propose, never silently write.** Any auto-adjustment goes through the Manual
  Override Window (ADR 0006 lesson: no silent writeback into Template Prescription).
- Exclude `no_prescription` rows (bootstrap, no snapshot).

## Runs

### Run #1 — 2026-10-03

2 athletes, 4 sessions cumulated, **2 sessions carrying deviations**, 30 events.
Queries 1–5 above, aggregate only.

| Measure | Value |
|---|---|
| Tap adoption | 27/30 = **90 %** non-null reasons (3 skipped) — target 60 % exceeded |
| `note` usage | 1/30 = **3 %** |
| Reasons | `strong` 21 · `pain` 5 · skipped 3 · `other` 1 |
| Direction × reason | `strong`+over 13 · `strong`+under 6 · `strong`+flat 2 · `pain`+under 5 · skipped+over 3 · `other`+over 1 |
| Deviation rate | 76.5 % (10-02) · 81 % (10-03) |
| Concentration | 9 exercises, 3–4 events each, **all in a single session** |

**Anomalies to clear before trusting the sample** (tracked in #609):

- `strong`+flat (2) — an event whose numbers match the Prescription Snapshot,
  which the T266 AC says cannot happen. Suspect `isLoadDeviation` (display-unit
  rounding / reps parsing) or an orphaned event from a set correction.
- 76–81 % deviation rate — over-firing detection, or athletes ignoring the
  prescription? Confront with a conforming athlete.

## Open questions (to settle while data accrues)

1. **Answered (run #1).** Threshold unlocks a rule on **distinct sessions, not
   sets** (one decision repeats per set). Per-slot, per-athlete: **≥ 3 distinct
   sessions** carrying the same reason × direction on that slot. A change to a
   **global default** needs **≥ 2 distinct athletes** each meeting their own
   threshold. `pain` is exempt — `HOLD` + tag immediately, never a load penalty.
2. **Answered (run #1): no.** `strong` is **not** redundant with "over" — it
   appears in over, under and flat. The reason carries signal beyond direction,
   so it stays.
3. **Answered (run #1): keep, don't invest.** 3 % usage. The field costs nothing;
   revisit only if it stays at zero after more volume.
4. Still open — no slot yet has cross-session signal (every slot lives in one
   session).

## Promotion trigger

When a slot meets the Q1 threshold **and** the run-#1 anomalies are cleared: open
the refactor epic (reason-aware `Last Performance` anchor + slot calibration) with
an ADR. Until then this file is read-only observation; the living tracker is #609.
