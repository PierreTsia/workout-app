# Epic Brief — Triple Progression Logic

## Summary

This epic implements a "Triple Progression" system (Reps x Weight x Sets) that turns the app from a passive training log into an opinionated coach. After each session, the engine analyzes what the user accomplished against prescribed rep and set ranges and suggests the next overload step: more reps, more weight, or more sets — in that order. The progression is surfaced as a clear, justified suggestion that the user can always override. This builds on top of the existing RIR tracking system, which continues to serve as an intra-session fatigue signal and acts as a safety gate for cross-session progression.

---

## Context & Problem

**Who is affected:** All users who follow a structured program (generated or manually built).

**Current state:**

- Users log sets with reps, weight, and RIR via `file:src/components/workout/SetsTable.tsx`
- The RIR system provides intra-session weight adjustments (RIR 0 → reduce, RIR 4+ → increase) via `file:src/lib/rirSuggestion.ts`
- Cross-session suggestion uses average RIR to nudge weight by 1-2 increments — a rough heuristic, not a structured progression model
- `workout_exercises` stores flat prescriptions: a single `reps` value (e.g. "10"), a single `sets` count, and `weight` — no ranges, no progression boundaries
- `template_exercises` has `rep_range` (e.g. "8-12"), but `adaptForExperience()` in `file:src/lib/generateProgram.ts` collapses it to a single value when creating user programs — the range information is lost
- The app records *what happened* but doesn't systematically guide *what should happen next*

**Pain points:**


| Pain                                           | Impact                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| No structured progression model                | Users plateau because they lack a systematic plan for when and how to increase load                                   |
| Rep ranges lost at program creation            | The valuable "8-12" range from templates is flattened to "10" — the progression boundaries vanish                     |
| Cross-session RIR suggestion is coarse         | Average RIR across all sets is a blunt instrument — doesn't account for rep-range completion or set-count progression |
| No visibility into "why" a suggestion was made | Users see auto-filled values but don't know the rationale, reducing trust and learning                                |
| Equipment ceiling is invisible                 | When a user maxes out available weight, there's no fallback path — they're stuck                                      |


---

## Goals


| Goal                                                  | Measure                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Automate session-to-session progression decisions     | 100% of reps-based exercises with rep ranges show a justified suggestion at session start                         |
| Implement the Reps → Weight → Sets overload hierarchy | Engine correctly applies the 3-step ladder in all test scenarios (4 regression cases from the issue + edge cases) |
| Preserve rep/set ranges from templates                | Generated programs carry `rep_range_min/max` and `set_range_min/max` through to `workout_exercises`               |
| Surface transparent rationale                         | Every suggestion includes a human-readable reason ("Max reps hit — increase weight")                              |
| Handle equipment ceilings gracefully                  | Users can flag `max_weight_reached` per exercise, triggering the Sets progression path                            |
| Maintain full user control                            | All suggestions are overridable; manual input always takes precedence                                             |


---

## Scope

**In scope:**

1. **Schema migration** — Add `rep_range_min`, `rep_range_max`, `set_range_min`, `set_range_max`, `weight_increment`, and `max_weight_reached` columns to `workout_exercises`. All nullable except `max_weight_reached` (boolean, default false). Backfill existing rows with ranges inferred from current `reps` and `sets` values (e.g. reps "5" → range 3-6, reps "10" → range 8-12). Exact inference formula defined in the Tech Plan.
2. **Program generation update** — Preserve `rep_range` from `template_exercises` when inserting `workout_exercises` rows. Parse "8-12" into `rep_range_min: 8, rep_range_max: 12`. Derive `set_range_min` from template `sets` count, `set_range_max` from `sets + 2` (capped reasonably).
3. **Quick workout / manual exercises** — Apply inferred default ranges when adding exercises manually or via quick workout generation.
4. **Pure progression engine** — Deterministic `computeNextSessionTarget()` function. Takes the current prescription + last session's per-set performance + average RIR → returns suggested reps, weight, sets, and a human-readable reason.
5. **Progression rules** (ordered by priority):
  - **HOLD** — Not all sets completed at target, or avg RIR < 1 (safety gate) → keep current targets. Reason: "Consolidate — not all sets hit target" or "Near failure — hold steady before progressing."
  - **REPS UP** — All sets completed at target but reps < `rep_range_max` → reps + 1. Reason: "Volume progression — increase reps."
  - **WEIGHT UP** — All sets hit `rep_range_max` AND `max_weight_reached` is false → weight + increment, reps reset to `rep_range_min`. Reason: "Intensity progression — increase weight, reset reps."
  - **SETS UP** — All sets hit `rep_range_max` AND `max_weight_reached` is true AND sets < `set_range_max` → sets + 1, reps reset to `rep_range_min`. Reason: "Density progression — add a set."
  - **PLATEAU** — All dimensions maxed → hold. Reason: "All progression paths exhausted. Consider deload or program change."
6. **RIR integration** — Triple Progression is the primary cross-session engine. The existing RIR-based cross-session suggestion (avg RIR → weight bump) is superseded for exercises with ranges. Intra-session RIR adjustments (`file:src/lib/rirSuggestion.ts`) remain untouched. RIR < 1 average acts as a safety gate that blocks weight/set increases even when rep targets are met.
7. **History hook** — Fetch per-set detail (reps, weight, completed, rir) for the most recent finished session containing a given exercise.
8. **Suggestion hook** — Combines the history hook with the `WorkoutExercise` prescription → calls the engine → returns a typed suggestion or null.
9. **Progression Pill UI** — Compact badge above the set rows in `SetsTable` when a suggestion exists. Displays the action ("+2.5kg", "+1 rep", "+1 set") and short reason. Tap opens a tooltip with the full rationale.
10. **Session finish persistence** — On session completion, compute next targets for each exercise and update `workout_exercises` rows (`reps`, `weight`, `sets`). Ensures the correct values are pre-loaded for the next session.
11. **Builder configuration** — Minimal "Progression Settings" section in the exercise edit sheet: rep range (min/max), set range (min/max), weight increment input, and a `max_weight_reached` toggle.
12. **i18n** — EN + FR strings for all progression reasons, pill labels, tooltip content, and builder labels.
13. **Test suite** — Exhaustive unit tests covering the 4 regression cases from the issue, the RIR safety gate, NULL ranges, duration exercises (excluded), first-ever session (no history), and the plateau scenario.

**Out of scope:**

- Pre-session exercise list showing progression suggestions (v2)
- Deload week detection or automatic deload programming
- Periodization awareness (mesocycle/macrocycle structure)
- Per-muscle-group or compound-vs-isolation differentiation in progression rules
- ML/AI-based adaptive suggestions (deterministic rules only)
- Global default settings for weight increment (per-exercise only in v1)
- RIR trend charts or progression history visualization
- Duration-based exercises (excluded from Triple Progression; they keep existing behavior)
- Analytics events for suggestion acceptance/override (deferred to analytics epic)

---

## Success Criteria

- **Numeric:** 100% of reps-based exercises with non-null rep ranges display a progression suggestion at session start
- **Numeric:** Engine produces correct output for all 4 regression test cases from the issue + 6 additional edge cases (10+ total test scenarios passing)
- **Numeric:** Zero NULL rep ranges on reps-based `workout_exercises` rows after migration backfill
- **Qualitative:** A user can read the Progression Pill and understand *why* the suggestion was made without needing external knowledge of training theory
- **Qualitative:** Suggestions always resolve to real plate increments (2.5 kg / 5 lbs default; user-configurable per exercise)
- **Qualitative:** Manual override is always available — suggestions never block input
- **Qualitative:** The RIR safety gate prevents premature weight increases when the user is training near failure (avg RIR < 1 → hold)

---

## Known Limitations & Future Evolution

Triple Progression operates **per-exercise, per-session**. It does not track total weekly volume per muscle group or implement mesocycle-based periodization (start at MEV, progress toward MRV, deload). This means:

- The "SETS UP" rule can push a single exercise's set count up without awareness of whether the muscle group's total weekly volume already exceeds MRV.
- There is no automated deload detection — the HOLD rule prevents forward progression on bad sessions, but never actively reduces volume after sustained stagnation.
- RP-style volume landmarks (MV, MEV, MAV, MRV) are not modeled.

These are deliberate v1 trade-offs. A future epic should layer **mesocycle-aware volume periodization** on top of this engine — see [GitHub Issue #149](https://github.com/PierreTsia/workout-app/issues/149).

---

## References

- [GitHub Issue #137](https://github.com/PierreTsia/workout-app/issues/137)
- `file:docs/done/Epic_Brief_—_RIR_Tracking_&_Auto-Suggestion_for_Load_Progression.md` — predecessor epic (RIR system)
- Progression methodology: [Renaissance Periodization](https://rpstrength.com/expert-advice/training-volume-landmarks-muscle-growth), [Stronger by Science](https://www.strongerbyscience.com/progression/), [3DMJ (Eric Helms)](https://3dmusclejourney.com/)

