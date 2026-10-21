# ADR 0034 — The prescribed load comes from a Load Ladder, not a constant increment

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decided in:** P4 grilling for the progression-engine epic [#705](https://github.com/PierreTsia/workout-app/issues/705)
- **Relates to:** ADR [0033](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0033-plateau-exit-triggered-by-prescription-stall.md) (the **Deload** is the last rung of the same escalation), ADR [0032](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0032-progression-anchor-reps.md), ADR [0006](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0006-decouple-template-from-progression-engine.md)

## Context

P4 of epic #705 is "the loads actually available in the gym". Today the engine steps the load by a
**constant increment** — `resolveWeightIncrement` (`file:src/lib/progression.ts:147`) returns 2.5 kg
for a barbell and 2.0 kg for a dumbbell, with a per-exercise override
(`workout_exercises.weight_increment`, editable in the Builder,
`file:src/components/builder/ExerciseDetailForm.tsx:277`). `WEIGHT_UP` then prescribes
`currentWeight + weightIncrement` (`file:src/lib/progression.ts:463`).

Real gyms do not step by a constant:

- Dumbbells run 2 kg apart to 20 kg, then 5 kg apart — a **+25 %** jump at the break.
- A stack or a cable tower is a pin at fixed positions, not a weight the athlete composes.
- A barbell's reachable totals are set by the **plates the athlete owns**, not by an increment.

So the engine can prescribe a load the athlete cannot physically compose. The epic left the modelling
question open ("paliers modélisés par salle, par exercice, ou les deux ?").

One further force: the domain **deliberately has no notion of location**. A **Program** carries no
goal, level, or location (`file:docs/CONTEXT.md`), and no **Gym** / **Location** term exists.

## Decision

We will give each **equipment category** a **Load Ladder** — the ordered list of loads the athlete can
actually compose — with a per-exercise override on the same two-layer shape as the legacy increment,
defaulting to a sensible ladder per category so nothing has to be declared. The engine prescribes
**only** loads present on the ladder, and a step above `LOAD_JUMP_MAX_RATIO` (~30 % of the current
load) is **refused**: the engine escalates to `SETS_UP` rather than prescribe a step the athlete would
fail.

## Consequences

- **Positive:** the infeasible-load bug is fixed for every athlete with **zero configuration** — no
  new entity, no new screen, no new i18n key. One concept is read twice (the step up, and the
  `**Deload**` step down). The escalation reps → load → sets → deload now has a principled third rung,
  and the `**Stall**` → `**Deload**` hand-off (ADR 0033) is reached only after reps *and* sets are
  exhausted.
- **Negative:** the default barbell ladder is a **guess** (a standard plate set, not the athlete's
  actual plates). A coarse gym now gets `SETS_UP` where it used to get a failing `WEIGHT_UP` — a new
  behaviour to test, and `LOAD_JUMP_MAX_RATIO` is an **unvalidated constant** (same status as
  `STALL_SESSIONS`). `weight_increment` survives only as the no-ladder fallback, so two ways to express
  a step coexist until the ladder is universal.
- **Follow-ups:** resolve the ladder by category with a per-exercise override; ship the default
  ladders; make `WEIGHT_UP` and `DELOAD` both read the ladder; decide the fallback when the current
  load is **not** on the ladder (legacy rows, a gym change). The declaration UI and the
  `EPLEY` / `BRZYCKI` formula choice are separate follow-ups, not prerequisites.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Plate inventory (declare plates + bar weight, compute reachable totals) | Faithful for the barbell **only**: it covers neither dumbbells (a fixed ladder) nor machines (a pin stack), so it needs a second model and a second input surface. |
| A per-gym entity with a declaration UI | Introduces a notion of location the domain has consistently avoided, to fix a rule a default ladder already fixes. |
| Per-exercise ladders only | Repeats the same dumbbell ladder across dozens of slots, and does not follow the athlete when the gym changes. |
| Always jump to the next available load (no threshold) | Leaves the announced bug half-fixed in coarse gyms: the athlete burns four sessions failing before the `**Stall**` fires. |
| Raise the rep ceiling past the declared range | That is the *rep-range ladder* deliberately excluded from the epic. |