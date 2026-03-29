# Epic Brief — Smarter Intra-Session Set Adjustment

## Summary

Replace the crude 3-bucket, weight-only `computeIntraSessionSuggestion` with a context-aware intra-session coaching engine that adjusts **both weight and reps** (up or down), detects **rep shortfalls** vs. prescription, applies **finer RIR granularity**, tracks **fatigue trends** across sets, **batch-updates all remaining sets** (re-evaluated on every confirmation), and selects the right **adjustment lever based on equipment type**.

---

## Context & Problem

**Who is affected:** Every user doing reps-based exercises with RIR tracking enabled.

**Current state:**
- `computeIntraSessionSuggestion` (file:src/lib/rirSuggestion.ts) is a stateless pure function with 3 RIR buckets
- Only the **weight** lever is used; reps always pass through unchanged
- Only the **next set** (N+1) is adjusted; remaining sets keep stale values
- No awareness of target reps — can't detect that the user hit 8 of a prescribed 12
- RIR 1-3 is a dead zone producing identical "hold" advice
- Called exclusively from `SetsTable.confirmRir` (file:src/components/workout/SetsTable.tsx)

**Pain points:**
| Pain | Impact |
|---|---|
| Reps never adjust | A coach would drop reps or adjust both levers, not just weight |
| RIR 1 = RIR 3 | Very different effort levels (near-failure vs. comfortable) get identical "hold" advice |
| No shortfall detection | Engine doesn't know the user hit 8 of a prescribed 12 |
| No fatigue awareness | A declining RIR trend across sets (3 → 2 → 1) is invisible |
| Stale remaining sets | Sets 4 and 5 keep original values even when set 2 signals fatigue |
| Weight-only for bodyweight/cables | 2.5 kg steps are meaningless for exercises where reps are the only lever |

---

## Goals

| Goal | Measure |
|---|---|
| G1: Adjust reps (not just weight) based on RIR + shortfall context — both up and down | Unit tests covering all RIR × shortfall × equipment combinations |
| G2: Split the RIR 1-3 dead zone into actionable buckets | RIR 0 (failure / deload), RIR 1-2 (efficiency zone / hold), RIR 3+ (undershoot / progress) produce distinct advice |
| G3: Detect rep shortfalls vs. prescription (`WorkoutExercise.reps`) | Function accepts target rep range and adjusts output when actual < range minimum |
| G4: Track fatigue trend across completed sets within the same exercise | Fatigue detection triggers correctly on synthetic declining-RIR sequences |
| G5: Batch-update all remaining (incomplete) sets on each RIR confirmation | All remaining sets reflect updated values; re-evaluated on every confirmation (not sticky); manually overridden sets are respected |
| G6: Select the primary adjustment lever based on equipment type | Reps-only equipment never produces weight adjustments unless user logged weight > 0 |

---

## Scope

**In scope:**
1. **New function signature** — `computeIntraSessionSuggestion` accepts target rep range, completed sets history, and equipment type
2. **Finer RIR buckets** — RIR 0 (failure / deload), RIR 1-2 (efficiency zone / hold), RIR 3+ (undershoot / suggest progression even if rep target is met — true progressive overload accounts for effort, not just reps)
3. **Rep adjustment logic** — reps can decrease (shortfall / fatigue), hold, or increase (RIR 3+ on reps-only equipment); target comes from `WorkoutExercise.reps` (parse range strings); output is always a concrete number, not a range
4. **Fatigue curve** — simple trend detection over completed sets: if RIR is declining for 2+ consecutive sets, apply conservative deload to remaining sets
5. **Batch update with manual override protection** — on RIR confirm, recalculate all remaining incomplete reps sets (not just N+1); each subsequent confirmation re-evaluates from scratch (deloads are not sticky); sets that the user has manually edited are **locked** and skipped by the engine (see below)
6. **Equipment-aware lever selection** — equipment is classified via an explicit `AdjustmentTier` type (see below); reps-only tier suppresses weight changes unless user has logged weight > 0 (weighted bodyweight detection)
7. **Unit tests** for the new engine covering all branches
8. **Existing cross-session progression is untouched** — `computeNextSessionTarget` in file:src/lib/progression.ts and `useProgressionSuggestion` remain separate

### Manual override lock

Add a `manuallyEdited` flag per `SessionSetRow`. When the user manually changes weight or reps on an incomplete set, mark it `manuallyEdited: true`. The batch-update engine **skips** any set where `manuallyEdited === true`. This prevents the engine from overwriting deliberate user choices.

### Equipment classification

Define an explicit `AdjustmentTier` type (`"weight-first" | "reps-only"`) and a mapping function from `exercises.equipment` string to tier — no magic string matching scattered across the engine.

| Tier | Equipment values | Primary lever | Secondary lever |
|---|---|---|---|
| `weight-first` | `barbell`, `dumbbell`, `ez_bar`, `machine`, `bench`, `kettlebell` | Weight (increment/decrement) | Reps (shortfall / fatigue only) |
| `reps-only` | `bodyweight`, `cable`, `band` | Reps (up / down) | Weight suppressed unless user logged weight > 0 |

**Weighted-bodyweight edge case:** If equipment is `bodyweight` but the user's logged weight > 0 on the current set (e.g. weighted pull-ups), treat as `weight-first` for the remainder of the exercise.

### Rep range parsing and output contract

- Input: `WorkoutExercise.reps` is a string — either a fixed number (`"10"`) or a range (`"8-12"`)
- **Shortfall threshold:** the lower bound of the range (or the fixed number). Hitting 7 on a `"8-12"` prescription = shortfall. Hitting 10 = within range, no shortfall.
- **Progression trigger:** the upper bound. Hitting 12 at RIR 4+ signals the user is ready for more.
- **Output:** always a concrete integer as a string (`"10"`), never a range. The engine picks a specific rep target for the next set.
- **Non-numeric strings** (`"AMRAP"`, `"to failure"`): pass through unchanged, no adjustment.

**Out of scope:**
- Duration exercises (RIR drawer doesn't exist for timers; deferred to a follow-up)
- UI changes to the RIR drawer itself (0-4 scale stays)
- Changes to the ProgressionPill or cross-session logic
- Percentage-based or RPE-based systems
- User-configurable coaching intensity / preferences

---

## Success Criteria

- **Numeric:** 100% of RIR × shortfall × equipment-tier matrix covered by unit tests
- **Qualitative:** After confirming RIR on set N, all remaining sets show contextually adjusted weight AND/OR reps — the user should rarely need to manually edit remaining sets
- **Qualitative:** Reps-only exercises (bodyweight, band) never suggest nonsensical weight changes (unless the user explicitly logged weight > 0)
- **Non-regression:** Existing cross-session progression behavior unchanged (existing tests pass)
- **Directional product signal:** reduction in manual overrides of intra-session suggestions (not measurable today, but the intent — define tracking mechanism in a follow-up)

---

## Key Assumptions

1. `WorkoutExercise.reps` is the source of truth for target reps — the **lower bound** of a range is the shortfall threshold; the **upper bound** is the progression trigger
2. Fatigue curve uses a simple "2+ consecutive declining RIR" heuristic, not a statistical model
3. Batch update recalculates all remaining non-locked sets on every confirmation (not sticky — a good next set can undo a previous deload); manually edited sets are never overwritten
4. Equipment classification uses the explicit `AdjustmentTier` type above; `cable` is reps-only because cable stacks have discrete jumps that don't map to standard increments
5. The existing 0-4 RIR scale is sufficient; no need for half-steps or expansion
6. The RIR coaching model is: **RIR 0 = deload, RIR 1-2 = efficiency zone (hold), RIR 3+ = undershoot (progress)** — this reflects evidence-based training where RIR 1-2 is the productive training zone and anything above signals underloading
7. The exact coaching rules for each RIR × shortfall × equipment cell will be defined in the Tech Plan — this brief defines the levers, boundaries, and philosophy, not the precise rule table
