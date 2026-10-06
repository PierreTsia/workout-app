# ADR 0026 — Deviation storage: dedicated table, referenced set, Jev-agnostic

- **Status:** Accepted
- **Date:** 2026-10-01
- **Decided in:** grilling session [#566](https://github.com/PierreTsia/workout-app/issues/566)

## Context

[#565](https://github.com/PierreTsia/workout-app/issues/565) / [#566](https://github.com/PierreTsia/workout-app/issues/566) capture the **why** of a **Deviation** — the athlete changed a set's load or reps away from its **Prescription Snapshot**, and we want the reason.

The Epic Brief + Tech Plan framed the data as **Jev-ready** and justified two choices by Jev:

- a **dedicated table** (`session_deviation_events`) — "a deviation is not always tied to a set";
- **denormalized** `prescribed_*` / `actual_*` columns on that table — "the Jev composition must not re-join `set_logs`".

The grilling session decided **Jev is out of the epic**, and cut the scope to `load_deviation` (set-level) only — `set_skipped`, `exercise_swapped`, `session_incomplete` are out. Both Jev-based justifications therefore collapse. What remains is the real constraint, stated by the product owner: **no Jev coupling now, but no re-schema the day Jev is wired.**

## Decision

We will:

1. Give the **Deviation Reason** a **single home**: `session_deviation_events`, one row per deviation. The concept **Deviation** lives in `docs/CONTEXT.md`.
2. **Reference** the logged set by identity — `session_id`, `workout_exercise_id`, `exercise_id`, `set_number` — instead of copying `prescribed_*` / `actual_*`. The numbers are read by joining `set_logs`. Copied columns **drift** the moment a set is re-logged.
3. Keep `kind` as `text + CHECK`, v1 = `load_deviation` only. Extending to new kinds is **one line of migration** — that is why `text + CHECK` was chosen over a Postgres enum.
4. Keep `reason_code` **nullable** (the reason is skippable) and **no longer constrained by a Jev `Choice`** — the vocabulary is a plain closed set for humans and analytics.
5. Ship **no Jev code and no Jev acceptance criterion** in the epic. When Jev is wired later it **reads this table without a migration**.

## Consequences

- **Positive:** the "reason" concept never forks into two storage shapes; no duplicated numbers to keep in sync; new kinds are additive; a future Jev reads one table.
- **Negative:** a new table plus RLS, an arch test, and a queue type, where two `set_logs` columns would have covered the present; the deviation's numbers require a join.
- **Follow-ups:** T266 (capture `load_deviation` end-to-end), T267 (session debrief + session note; the recap's deviation section was later removed by [#665](https://github.com/PierreTsia/workout-app/issues/665)).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| `deviation_reason` / `deviation_note` columns on `set_logs` | The concept forks the moment a second kind (skipped set, swap) arrives; a later Jev would read two schemas. |
| Denormalize `prescribed_*` / `actual_*` into the event table | Duplication that drifts on re-log; justified only by Jev, which is out of scope. |
| Model all four original kinds in the `CHECK` now | Speculative debt; adding a value is trivial with `text + CHECK`. |
| Immutable append-only snapshot of the numbers | Defensible for an audit trail, but duplicates and drifts; not needed for v1. |
