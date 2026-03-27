# Epic Brief — Generalized Progression Engine

## Summary

Extend the Triple Progression engine so it works for **all** exercise types — not just reps-based. Duration exercises (planks, holds, carries) gain cross-session progression suggestions: longer holds, added weight (if loadable), or more sets. Bodyweight exercises with optional loading (weighted vest, plate) participate seamlessly by treating unloaded as `weight = 0` with `max_weight_reached = true` by default. The engine becomes volume-type-agnostic via a unified `VolumePrescription` interface while keeping training-specific increments (e.g., +5s for holds vs +1 rep for lifts) and decoupled output rules (`REPS_UP` / `DURATION_UP`) for maintainability.

---

## Context & Problem

**Who is affected:** Users with duration-based exercises in their programs (planks, wall sits, loaded carries, etc.)

**Current state:**
- Triple Progression engine (`file:src/lib/progression.ts`) is fully shipped and works well — but **only for reps exercises**
- `useProgressionSuggestion` returns `null` when `measurementType === "duration"` (line 24 of `file:src/hooks/useProgressionSuggestion.ts`)
- Duration exercises have their own session UI (`DurationSetTimer`) and logging (`duration_seconds` in `set_logs`) — all shipped
- `workout_exercises` has `rep_range_min/max`, `set_range_min/max`, `weight_increment`, `max_weight_reached` — but no duration equivalents
- The ProgressionPill, auto-apply effect in SetsTable, and session-finish persistence all bail out for duration exercises

**Pain points:**

| Pain | Impact |
|---|---|
| Duration exercises are progression dead zones | The app tracks them but never suggests improvement — users plateau silently |
| Bodyweight exercises that *could* be loaded have no weight progression path | Weighted planks, dips with belt, etc. get no coaching to increase load |
| `REPS_UP` rule and `ProgressionPrescription` type are reps-shaped | No way to represent "increase hold time" — the abstraction doesn't support it |
| Mixed programs get partial coaching | Users doing bench press + plank get suggestions for half their exercises and silence for the other half |

---

## Goals

| Goal | Measure |
|---|---|
| Full progression coverage | 100% of exercises with progression ranges (reps or duration) show a suggestion at session start — no more `null` for duration |
| Unified engine via `VolumePrescription` | Single `computeNextSessionTarget()` operates on `{ type, current, min, max, increment }` — zero `if (reps) / else (duration)` branching in the core ladder |
| Decoupled output rules | `REPS_UP` and `DURATION_UP` remain separate enum values — changing behavior for one type never impacts the other |
| Smart bodyweight defaults | `max_weight_reached` defaults to `true` for bodyweight equipment, letting the ladder skip WEIGHT_UP naturally |
| Auto-detect loading | When a user logs weight > 0 on a `max_weight_reached === true` exercise, the app proposes flipping the flag — prevents SETS_UP when the user clearly wants WEIGHT_UP |
| Schema completeness | Zero NULL duration ranges on duration `workout_exercises` rows after migration |

---

## Scope

**In scope:**

1. **Schema: duration range columns on `workout_exercises`** — `duration_range_min_seconds` (int, NOT NULL for duration exercises), `duration_range_max_seconds` (int, NOT NULL), `duration_increment_seconds` (int, nullable — engine uses default 5s when NULL). Backfill existing duration exercises with sensible defaults derived from `target_duration_seconds` (e.g., target 30s → range 20-45s, increment 5s).

2. **Unified `VolumePrescription` interface** — The engine's core abstraction. No branching on volume type inside the progression ladder:

```typescript
interface VolumePrescription {
  type: 'reps' | 'duration'
  current: number      // current reps or current seconds
  min: number          // rep_range_min or duration_range_min
  max: number          // rep_range_max or duration_range_max
  increment: number    // 1 rep or 5s (configurable)
}
```

`ProgressionPrescription` embeds this alongside `currentWeight`, `currentSets`, `setRangeMin/Max`, `weightIncrement`, `maxWeightReached`. The engine operates on `volume.current`, `volume.min`, `volume.max`, `volume.increment` — never checks `volume.type` for ladder logic. Type is only used at the output stage to map to the correct `ProgressionRule` (`REPS_UP` vs `DURATION_UP`).

3. **New `DURATION_UP` rule, `REPS_UP` stays** — Two separate enum values for decoupled maintainability. Internally, the engine operates on `VolumePrescription` without branching — but the output maps `volume.type === 'duration'` to `DURATION_UP` and `volume.type === 'reps'` to `REPS_UP`. Each rule gets its own i18n keys, icon, and delta format. Changing duration progression behavior never risks breaking reps behavior.

4. **`useProgressionSuggestion` unblocked for duration** — Remove the `if (duration) return null` guard. Build `VolumePrescription` from duration range fields when `measurementType === 'duration'`. Map `SetPerformance` from `duration_seconds` logged values (treating seconds as the volume dimension).

5. **`SetPerformance` extension** — Add optional `durationSeconds: number` field. For duration exercises, `reps` is ignored; `durationSeconds` drives the volume comparison in the engine (mapped to the generic volume axis).

6. **`useLastSessionDetail` extension** — Return `duration_seconds` from `set_logs` when available, mapped into `SetPerformance.durationSeconds`.

7. **ProgressionPill contextual rendering** — The pill's delta label is always derived from context, never hardcoded:
   - `DURATION_UP` → `+5s` (or configured increment), Clock icon
   - `REPS_UP` → `+1 rep`, TrendingUp icon
   - `WEIGHT_UP` → `+2.5kg` (or configured increment in display unit), Dumbbell icon
   - `SETS_UP` → `+1 set`, Layers icon
   - New i18n keys: `progression.durationUp`, `progression.durationUpDetail`
   - Existing keys unchanged: `progression.repsUp`, `progression.weightUp`, etc.

8. **SetsTable auto-apply for duration** — Remove `isDurationExercise` bail-out in the progression auto-apply `useEffect`. Apply suggestion to `SessionSetRowDuration` rows: update `targetSeconds` (and `weight` if WEIGHT_UP).

9. **Session finish persistence for duration** — `handleFinish()` computes progression targets for duration exercises too. `progressionTargets` payload extended with optional `targetDurationSeconds`.

10. **Builder config for duration ranges** — In `ExerciseDetailEditor`, when exercise is duration-type, show duration range (min/max seconds) and duration increment inputs in the Progression Settings collapsible. Hide rep range fields; show duration range fields instead.

11. **Smart bodyweight defaults + auto-detect loading** — Two complementary rules:
    - **Default:** When creating a `workout_exercises` row for `equipment === 'bodyweight'`, default `max_weight_reached` to `true`. User can toggle it off in builder.
    - **Auto-detect:** When session finish detects that logged weight > 0 on an exercise where `max_weight_reached === true`, surface a prompt (toast or inline) asking the user to flip `max_weight_reached` to `false`. This prevents the engine from suggesting SETS_UP when the user is clearly loading the exercise and should get WEIGHT_UP suggestions instead.

12. **Program generation / quick workout paths** — All 4 insertion paths that create `workout_exercises` rows populate duration range columns for duration exercises (parallel to existing rep range population).

13. **i18n** — EN + FR strings for all new progression keys (`DURATION_UP` reason/detail, builder labels for duration ranges, auto-detect loading prompt). Existing `REPS_UP` keys unchanged.

14. **Tests** — Unit tests for `computeNextSessionTarget` with duration prescriptions (`DURATION_UP` +5s, HOLD, WEIGHT_UP after max duration, SETS_UP, PLATEAU, auto-detect loading trigger). Test that the engine uses `VolumePrescription` generically. Test `useProgressionSuggestion` no longer returns null for duration. Test SetsTable auto-apply for duration rows.

**Out of scope:**

- Intra-session RIR adjustments for duration exercises (no RIR drawer for timer sets — that's #158 territory)
- Duration-based PRs ("longest hold" tracking) — separate concern
- Deload/periodization awareness
- Changing the duration timer UI or adding RIR collection to duration sets
- Analytics events for suggestion acceptance/override

---

## Success Criteria

- **Numeric:** 100% of duration exercises with non-null duration ranges show a progression suggestion at session start
- **Numeric:** Engine produces correct output for all test scenarios (DURATION_UP +5s, REPS_UP +1 rep, HOLD, WEIGHT_UP, SETS_UP, PLATEAU, auto-detect loading — 8+ test cases)
- **Numeric:** Zero NULL duration range columns on duration `workout_exercises` rows after migration
- **Numeric:** Zero `if (type === 'reps') / else` branches inside `computeNextSessionTarget()` core ladder logic — the engine operates on `VolumePrescription` generically; only the output rule mapping uses `volume.type`
- **Qualitative:** A plank exercise shows "+5s" progression suggestion after completing all sets at target duration
- **Qualitative:** A weighted plank (user opted into loading) suggests "+2.5kg" after maxing out duration range
- **Qualitative:** A pure bodyweight plank skips weight and goes directly seconds → sets → plateau
- **Qualitative:** When a user manually adds 5kg to a bodyweight exercise, the app proposes flipping `max_weight_reached` so future sessions suggest WEIGHT_UP instead of SETS_UP
- **Qualitative:** ProgressionPill renders contextually: "+5s" for `DURATION_UP`, "+1 rep" for `REPS_UP`, "+2.5kg" for `WEIGHT_UP` — each with its own icon and i18n keys

---

## Decisions Made

1. **Unified `VolumePrescription` interface** — The engine never branches on `type` in its core ladder logic. Works on generic `{ current, min, max, increment }`. `type` is only read at the output stage to map to the correct `ProgressionRule`.
2. **Separate `REPS_UP` / `DURATION_UP` enum values** — Decoupled for maintainability. Changing duration progression behavior (e.g., different increment logic later) never risks breaking reps. Each rule gets its own i18n keys, icon, and delta format. Existing `REPS_UP` keys and behavior untouched.
3. **Auto-detect loading on bodyweight exercises** — If a user logs weight > 0 on an exercise where `max_weight_reached === true`, the app proposes flipping `max_weight_reached` to `false`. Prevents SETS_UP suggestions when the user is clearly loading.
4. **Duration ranges NOT NULL after migration** — Same philosophy as rep ranges. Backfill from `target_duration_seconds` with a band (e.g., 30s target → 20-45s range, 5s increment).
5. **Default duration increment: 5 seconds** — Flat default, user-configurable per exercise via `duration_increment_seconds`. For very long holds, user increases the increment in builder.
6. **`max_weight_reached` defaults to `true` for `equipment === 'bodyweight'`** — Combined with auto-detect (point 3), this covers both pure bodyweight and loaded bodyweight transitions gracefully.
7. **Intra-session RIR out of scope** — Duration sets don't collect RIR today. Adding that UI is #158 territory. This epic uses cross-session data only (did they complete? what duration was logged?).
8. **Existing Triple Progression epic explicitly excluded duration** — This brief is a deliberate v2 expansion, referenced as "prior art / v1 scoping decision."

---

## Known Limitations & Future Evolution

The generalized engine operates **per-exercise, per-session** — same as the reps-only predecessor. It does not:

- Track total weekly volume per muscle group or implement mesocycle-based periodization
- Detect or program deloads — the HOLD rule prevents forward progression on bad sessions but never actively reduces volume
- Model RP-style volume landmarks (MV, MEV, MAV, MRV)
- Provide intra-session RIR adjustments for duration exercises — that belongs in [Issue #158](https://github.com/PierreTsia/workout-app/issues/158)
- Track duration-based PRs ("longest hold") — separate concern for a future epic

These are deliberate v1 trade-offs. A future epic should layer **mesocycle-aware volume periodization** on top of this engine — see [Issue #149](https://github.com/PierreTsia/workout-app/issues/149).

---

## References

- [GitHub Issue #156](https://github.com/PierreTsia/workout-app/issues/156)
- Prior art: `file:docs/Epic_Brief_—_Triple_Progression_Logic.md` (reps-only engine, explicitly excluded duration)
- Prior art: `file:docs/Epic_Brief_—_Duration-Based_Exercises_&_Set_Timer.md` (duration UI, no progression)
- Prior art: `file:docs/Tech_Plan_—_Triple_Progression_Logic.md` (existing engine architecture)
- Prior art: `file:docs/Tech_Plan_—_Duration-Based_Exercises_&_Set_Timer.md` (duration data model and UI)
- Code: `file:src/lib/progression.ts`, `file:src/hooks/useProgressionSuggestion.ts`, `file:src/components/workout/SetsTable.tsx`
