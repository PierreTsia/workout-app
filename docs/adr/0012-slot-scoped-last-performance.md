# ADR 0012 — Scope Last Performance to the Exercise Slot

- **Status:** Accepted
- **Date:** 2026-08-07
- **Decided in:** grill-with-docs session for [#463](https://github.com/PierreTsia/workout-app/issues/463)

## Context

**Last Performance** was defined as the most recent `set_logs` for a catalog
`exercise_id`, regardless of which **Program** or day prescription produced
them. That matches “athlete capacity on a movement” but breaks when the same
catalog exercise appears under two different training intents — e.g. progressive
overload at the gym (`3×10 @ 22kg`) and a lighter home HIIT day (`@ 8kg`).

The engine then anchors the gym **Progression Suggestion** on the HIIT load.
ADR 0007 already excludes **Exercise Block** logs from
`get_last_performance_for_exercises`, but that does not cover two **solo**
**Exercise Slots** that share a catalog id.

`set_logs` already has `block_exercise_id` for circuit cells; it has no link
back to the solo `workout_exercises` row, so slot scope cannot be expressed
without a schema change.

## Decision

We will:

1. **Treat the Exercise Slot as the progression identity.** **Last Performance**
   (and the **Manual Override Window**'s `last_session`) is the most recent
   session that logged that slot, matched on
   `(workout_exercise_id, exercise_id)` so a Builder swap onto the same row
   does not inherit the previous movement's logs.

2. **Add `set_logs.workout_exercise_id`** — nullable FK → `workout_exercises(id)`
   with `ON DELETE SET NULL`. Written on every solo set-log path; left `NULL`
   for **Exercise Block** logs (still out of the engine per ADR 0007).

3. **Do not eager-backfill historical solos onto current slots.** “Exactly one
   slot for this catalog exercise on the day *now*” is not proof the day was
   unambiguous *when the log was written* — a deleted heavy/light sibling would
   stamp the wrong intent onto the survivor (reintroducing #463). Legacy /
   orphan rows stay `NULL` and **bootstrap** from **Template Prescription** —
   no global `exercise_id` fallback. Forward writes set `workout_exercise_id`
   from the live slot.

4. **Scope session prescription / prefill, not athlete analytics.** Engine
   paths (`get_last_performance_for_exercises`, `useLastSessionDetail`),
   in-session “last time” (`useLastSession`), and existing-slot weight prefill
   follow the slot. Trends, history, and PRs stay catalog-global. Seeding
   weight when *adding* or *swapping* a catalog exercise into a day may still
   read last catalog-global load (bootstrap for a new/changed slot).

5. **Accept identity costs.** New programs, deleted/recreated slots, and
   **Quick Workout** / `create_workout_day` days mint new slots → fresh
   progression (template bootstrap). No cross-program inheritance in #463.

## Consequences

- **Positive:** Alternating programs (or two intents in one program) no longer
  cross-contaminate **Progression Suggestion** / prefill. **Manual Override
  Window** stops being opened/closed by unrelated catalog sessions. Glossary
  gains **Exercise Slot** as the structural unit aligned with **Template
  Prescription**.
- **Negative:** Recreating a program or slot resets the progression chain for
  that prescription (unless the template already carries the right load).
  Quick Workouts never accumulate engine progression across days. Two “last
  weight” notions coexist (slot vs catalog) — mitigated by clear consumer
  split (session vs analytics). **All pre-migration solo logs bootstrap** from
  **Template Prescription** on first post-deploy session (no historical slot
  attachment) — the Builder template must carry the correct working weight.
- **Follow-ups:** Optional later epics: fork-program-keep-progression;
  pedagogical UI when bootstrap replaces a would-be cross-intent anchor;
  historical slot reconstruction if we ever retain deleted `workout_exercises`.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Scope by Program only** | Same program can still host heavy + light solos of one catalog exo; does not match intent. |
| **Keep global Last Performance + Manual Override workaround** | Forces the user to edit the Builder before every context switch; not a model. |
| **Infer slot without a FK** (join day + `exercise_id`) | Ambiguous when the same exo appears twice in a day — already called out in `useProgressionSuggestionsForDay`. |
| **Eager backfill when day has exactly one slot *now*** | Deleted dual-intent sibling makes “unique now” a lie; stamps wrong history onto the survivor (Bugbot on #464). |
| **Fallback to global `exercise_id` for null FK rows** | Reintroduces HIIT→gym pollution for any unbackfilled or orphan log. |
| **Scope trends/history/PRs to the slot too** | Destroys “how am I progressing on rowing as an athlete?” analytics. |
| **Inherit progression when creating a new program** | Useful later; separate feature from fixing the identity bug. |
