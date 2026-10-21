# ADR 0033 — The plateau exit triggers on prescription stagnation, not on `PLATEAU`

- **Status:** Accepted
- **Date:** 2026-10-20
- **Decided in:** P2 analysis for the progression-engine epic [#705](https://github.com/PierreTsia/workout-app/issues/705)
- **Relates to:** ADR [0006](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0006-decouple-template-from-progression-engine.md) (Template Prescription vs Progression Engine), ADR [0032](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0032-progression-anchor-reps.md) (progression anchor reps — this ADR **honours its follow-up** "P2 / P3 read the anchor rather than re-deriving it")

## Context

P2 of epic #705 ([source doc](https://github.com/PierreTsia/workout-app/issues/705)) was scoped as "a
way out of `PLATEAU`": beyond N consecutive sessions served in `PLATEAU`, prescribe a deload week.

The epic carries its own prerequisite before building this: instrument the served rules and check
whether `PLATEAU` is reached in practice, "otherwise P2 solves a problem that does not exist". P1
(#706) shipped that instrumentation, but it is **merged, not deployed** (the release PR #707 is still
open), so the served-rule event stream has no rows in production — the observatory answers nothing
yet. The only substrate available today is `set_logs`.

Reading it:

- **`PLATEAU` is essentially unreachable.** It requires `maxWeightReached` (a **flag the athlete sets
  by hand** on the slot), every set ≥ `volume.max`, and `currentSets ≥ setRangeMax`. Across the whole
  production history (1230 slots, 267 finished sessions) a proxy for that conjunction matches
  **one single slot** (13 sessions, last in August).
- **A `was_pr = false` streak is a bad trigger.** It reads 90 slots stuck ≥3 sessions — but a linear
  progression never re-beats its *all-time* best, so it flags athletes who are progressing fine.
- **Prescription stagnation is the real signal.** Consecutive sessions where `prescribed_reps` **and**
  `prescribed_weight` do not increase — i.e. the engine serving a hold — match **22 slots** (18 at
  ≥4 sessions, most recent 19/10). It is the literal statement "the engine has nothing more to give",
  and it *subsumes* `PLATEAU` (a prescription frozen at the ceiling).

Two structural facts shaped the design. The engine is **stateless per session**: it recomputes from
history, so any exit condition must be *derivable* — and a deloaded session is never a PR, so the
trigger stays true forever unless the engine can recognise it already served a deload. And the
intra-session engine already carries a deload convention: `PROPORTIONAL_DELOAD_FACTOR = 0.85` for
reps-only equipment (`file:src/lib/rirSuggestion.ts`).

## Decision

We will:

1. Trigger the deload on a **Blocage**, not on `PLATEAU`: `STALL_SESSIONS = 4` consecutive sessions
   whose **served target** — `anchor_reps ?? prescribed_reps` for reps (ADR 0032), `prescribed_weight`
   for load — is **strictly equal** session over session, **and** the last session's average **RIR** ≤ 1
   (genuine saturation, not comfortable stagnation). Equality, not "not increasing": the engine serves a
   *hold* (same value) when it has nothing more; a value that **drops** is an intervention (a served
   deload, or a manual change) and must not read as a stall. An undeclared RIR is not a zero: no average
   means no deload, the same rule as any other unavailable signal.
2. Add a `DELOAD` **Progression Rule**, auto-applied like `WEIGHT_UP`: load −1 increment (the slot's
   `weightIncrement`, 2.5 kg barbell / 2 kg dumbbell by default); for *reps-only* equipment
   (`bodyweight`, `cable`, `band`) reps ×0.85, reusing `PROPORTIONAL_DELOAD_FACTOR`. Sets, range and
   the duration axis untouched — **duration is out of v1**.
3. Keep the state **derived, with no new column and no persisted rule**: the deload lasts exactly
   **one session**, and the exit needs no dedicated check — a served deload makes the served target
   *drop*, which breaks the equality and lets the normal engine resume from the deloaded step.
4. Let the **Manual Override Window** win, as it does for every other rule. The flag is computed inside
   `buildPrescription` and carried on `ProgressionPrescription` so the rule can read it.
5. Surface it: a visible "Décharge" label, like the other auto-applied rules (i18n copy pass).
6. Supersede the source doc's grain: it proposed "a deload week (one step down, **reduced volume**)".
   We ship **one session, sets untouched** — a reduced-set week is a different product object.

## Consequences

- **Positive:** the exit targets a state that actually occurs (22 slots vs 1 for `PLATEAU`); it needs
  no new persisted state, no replay of history, and no dependency on P3 / e1RM; it reuses an existing
  factor and the existing weight-propagation rule; `PLATEAU` remains a valid (if rare) rule without
  being the only unaddressed state.
- **Negative:** the trigger rests on a heuristic (`STALL_SESSIONS = 4`, RIR gate) not validated by
  research — to tune post-launch like the draft-step `N = 6`. Detecting four past sessions per slot
  needs an **N-session history read**, heavier than today's single-session
  `get_last_performance_for_slots` — the real cost of P2, owned by its Tech Plan. The derived exit
  compares served-vs-applied, so a **manual** load drop by the athlete (not following the deload) can
  be misread as "deload served".
- **Follow-ups:** the duration axis (`DURATION_UP` deload) if the same hole shows there; a served-rule
  event or column if a future rule needs more state than one comparison. The epic's own prerequisite
  still stands: once P1 is deployed, confirm the real served-rule distribution and tune `N`. The body of
  [#705](https://github.com/PierreTsia/workout-app/issues/705) still carries the source doc's wording
  ("une semaine de décharge … volume réduit") and its AC "`PLATEAU` a une sortie" — reconcile it with
  this ADR.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Deload after N sessions served in `PLATEAU`** (the source doc) | Every precondition exists in code, but the conjunction matches one slot ever — it builds for a ghost. |
| **Deload after N sessions without a PR** (`was_pr = false`) | `was_pr` is the all-time best; a linear progression never re-beats it, so the trigger fires on athletes who are progressing (90 slots). |
| **Persist a per-slot deload state** (`workout_exercises.deload_at`) | Explicit, but a new client-written state to keep in sync (drift, multi-device) where a comparison of two persisted columns suffices. |
| **Persist a `prescribed_rule` column on `set_logs`** | Gives the state cleanly and would serve P3/P4, but reopens P1's deliberate choice (T706: the rule lives in `analytics_events`, not in a column). |
| **Deload until success** (hold the reduced target until it is hit at the ceiling) | Gentler, but the exit stops being derivable from a single comparison; the state creeps back in. |