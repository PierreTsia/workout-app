# ADR 0006 — Decouple Template Prescription from the Progression Engine

- **Status:** Accepted
- **Date:** 2026-05-27
- **Decided in:** Grilling session for [#373 — Engine retroactively reframes 'nailed it' as 'missed reps' after a REPS_UP bump](https://github.com/PierreTsia/workout-app/issues/373)

## Context

After a successful `REPS_UP`, `enqueueSessionFinish` writes `suggestion.reps` back into `workout_exercises.reps` (`file:src/lib/syncService.ts:694-703`). On the *next* session, the engine reads `volume.current = parseInt(exercise.reps, 10)` from the now-mutated template (`file:src/lib/progression.ts:101`) and compares it against the previous session's logs — which still reflect the *pre-bump* prescription. The result: a clean previous session gets retroactively classified as `HOLD_INCOMPLETE`, with copy that says *"keeping 3×11"* under a *Dernière fois 3×10* line. The engine is scoring its own previous bump as a failure.

Three things make this worse than a single mislabel:

1. **The template lies about user intent.** The Builder shows `reps = 11` even though the user originally programmed `10`. Range strings (`"8-12"`) get clobbered to single integers (`"9"`) by the writeback's `String(t.reps)` cast, breaking `rirSuggestion.ts`'s range parsing.
2. **The asymmetry was already documented.** `currentWeight` already prefers `lastPerformance.weight` over `templateWeight` (`file:src/lib/progression.ts:117-118`), making the writeback to `weight` decorative. `reps`, `sets`, and `target_duration_seconds` had no such guard and got the full bug.
3. **No legitimate readers want the post-bump value.** An audit of every consumer of `workout_exercises.{reps,weight,sets}` found that they either (a) ignore the template in favor of the suggestion or last-row (e.g. `SetsTable.tsx:641`, `ExerciseEditRowControls.tsx:60`), (b) want user intent and are silently corrupted (Builder editors, range parsing), or (c) *are* the engine reading its own previous output.

#371 made the bug visible everywhere by surfacing the **Progression Suggestion** on the pre-session list, but the bug itself predates #371. Same data path will produce identical mislabels on `HOLD_NEAR_FAILURE`, set-count, and duration axes.

The issue described three fix options (band-aid, snapshot, kill writeback). After grilling, none of them was sufficient on its own — the actual fix is **kill writeback + snapshot prescription + add a manual-override mechanism**, applied to all four volume axes in one PR.

## Decision

We will:

1. **Stop the writeback.** `enqueueSessionFinish` no longer writes `suggestion.{reps, weight, sets, target_duration_seconds}` back into `workout_exercises`. **Template Prescription** becomes pure user intent, written only by the Builder and program-creation flows.

2. **Snapshot prescription on `set_logs`.** Add nullable columns `prescribed_reps INT`, `prescribed_weight NUMERIC`, `prescribed_sets INT`, `prescribed_duration_seconds INT` on `set_logs`. The engine reads `volume.current` and `currentSets` from the most recent session's snapshot rather than from `workout_exercises`. This is the **Prescription Snapshot**.

3. **Snapshot rule.** `prescribed_*` = the engine's pristine **Progression Suggestion** at session-start (or the **Template Prescription** values on bootstrap, when no `Last Performance` exists yet). Mid-session row edits become actuals (`reps_logged`, `weight_logged`), not new prescriptions. Permanent intent shifts go through **Manual Override Window** (Builder edit pre-session) instead. *(Revised after tech-plan stress test: an earlier draft used "displayed at log-time" semantics, which broke `HOLD_INCOMPLETE` detection — if a user attempted 11 reps but only managed 8 and typed "8" in the row before logging, we'd snapshot prescribed=8 = logged=8 → REPS_UP, losing the signal that the user was trying for 11.)*

4. **Eager backfill, not lazy fallback.** One-time migration sets `prescribed_X = X_logged` for every historical row, and `prescribed_sets = COUNT(*)` over `(session_id, exercise_id)`. Engine's read path stays uniform after migration; nullability is kept as a defensive shape only. Honest bounded lie: legacy rows where the last pre-migration session was incomplete get an incorrect `REPS_UP`/`SETS_UP` for *that* user's first post-migration session, then the system is clean forever.

5. **Manual Override Window.** Add `workout_exercises.template_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, maintained by a Postgres trigger that fires `BEFORE UPDATE OF reps, weight, sets, target_duration_seconds` and only bumps when the value actually changes (`IS DISTINCT FROM` checks inside the trigger function). The engine reads from **Template Prescription** instead of **Prescription Snapshot** when `template_updated_at > last_session.finished_at`. Lets users deload, return from injury, or correct a fluke session by editing the Builder — for all four axes, including `weight` (which had no override path at all before).

6. **Apply to all four volume axes in one PR.** The fix collapses to the same code path; splitting reps/weight/sets/duration across PRs would mean three migrations and three windows where one axis is broken while another is fixed.

## Consequences

### Positive

- Closes #373 root cause. Engine no longer scores its own previous bump as failure.
- Closes the latent same-shape bug on `HOLD_NEAR_FAILURE` and on the duration / set-count axes.
- Closes the **Template Prescription** "no clean override path" limitation for all four axes (weight included — was broken since the engine shipped).
- Builder fields stop being silently corrupted by the engine. `rirSuggestion.ts`'s range-string parsing (`"8-12"`) stops being clobbered.
- Unlocks honest analytics — `set_logs.prescribed_*` JOIN on actuals lets us answer "what % of sets hit prescribed reps?" without lying about what was prescribed at the time.
- `workout_exercises.weight`'s asymmetric "ignored after first session" behavior gets unified with the other three axes under one rule.

### Negative

- Schema migration with a backfill `UPDATE` on every historical `set_logs` row. Bounded by table size; brief lock.
- Honest bounded lie at backfill: last-session-before-migration partial failures get masked as full completions. At most one mislabel per user, then clean forever.
- Adds `template_updated_at` column + trigger. New invariant to maintain (mitigated by trigger covering all write paths automatically).
- Engine read path gains a branch (`Manual Override Window` vs `Prescription Snapshot`). Slightly less uniform, but the alternative — trigger-free, app-level timestamp maintenance — silently breaks any time someone forgets to bump it on a new write path.

### Follow-ups

- Update `CONTEXT.md`: revise **Template Prescription**, add **Prescription Snapshot**, add **Manual Override Window**. *(Done in this commit.)*
- Tech plan for the implementation (migration shape, engine refactor, set-log write path threading).
- `sessionSummary.ts:121` reads `Number(ex.weight)` as `maxWeight` — latent drift bug now exposed (was masked by the writeback making `ex.weight` the high-water mark by accident). Consider shifting to `MAX(set_logs.weight_logged)`. Out of scope for this ADR.
- UX discoverability of the new override capability. With this fix, Builder edits to `weight` / `reps` / `sets` actually stick — but users don't know that. Whether to surface this (a "deload" button, a hint, etc.) is a separate product issue.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Band-aid in `computeNextSessionTarget`** — detect when logs match `volume.current - increment` and re-emit `REPS_UP` | ~10 LOC fix that papers over the data-model issue. Doesn't address Builder corruption, range-string clobbering, `sessionSummary.maxWeight` drift, or the parallel duration / set-count bugs. Future-self would re-grill. |
| **Snapshot only, keep writeback** | Fixes the engine's read path but leaves Builder / range / summary corruption untouched. Half-measure. |
| **Kill writeback, no override mechanism** | Strict regression on the deload flow — manual Builder edits would go from "works for one session before writeback eats them" (today) to "never works, engine reads only from snapshot" (post-fix). The issue's "option C makes it moot" claim was wrong; killing the writeback alone locks the engine into snapshot reads forever. |
| **Lazy NULL fallback at engine read time** instead of eager backfill | Spreads the legacy ambiguity into permanent engine code. Harder to reason about than a one-time honest lie at migration time. |
| **App-level `template_updated_at` maintenance** | Multiple write paths (Builder, AI program creation, MCP `create_program`, future tools) — single forgotten path = silent override regression. Trigger covers everything by construction, including writes we haven't thought of yet. |
| **`prescribed_sets` inferred from `COUNT(set_logs)` instead of snapshotted** | Re-introduces the "implicit memory in actuals" ambiguity for the set-count axis specifically (did the user fail to hit 4, or just stop at 3 because that's what they wanted?). Storage cost of one denormalized integer per `set_log` is trivial; symmetry across all four axes is worth a lot for the engine's read code. |
| **`prescribed_reps` as `TEXT`** (mirroring `workout_exercises.reps`) | The engine already resolves range strings to a single integer at session-start; per-set range storage would be lossy gibberish ("which value in 8-12 was the user trying for?"). `INT` is correct regardless of how the engine eventually handles ranges. |
