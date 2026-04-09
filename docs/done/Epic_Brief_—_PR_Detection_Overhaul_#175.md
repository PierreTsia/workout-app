# Epic Brief — PR Detection Overhaul #175

## Summary

The Personal Record detection system is fundamentally broken across all three exercise types. Weighted exercises inflate PRs by counting every first-ever set as a record. Bodyweight exercises (push-ups, pull-ups, dips) can never register a PR because the Epley formula returns 0 when weight = 0. Duration exercises (planks, holds) have PR detection hardcoded to `false`. This epic overhauls PR detection to be type-aware, honest, and retroactively correct — then backfills all historical data.

---

## Context & Problem

**Who is affected:** All users. The PR system is a core motivational feature that feeds the Record Hunter achievement track, the in-session PR celebration (confetti, badge), and the history charts. When it's wrong, trust erodes.

**Current state:**
- PR detection lives in `file:src/components/workout/SetsTable.tsx` (line 333-334)
- Comparison uses `file:src/hooks/useBest1RM.ts` which returns the historical best estimated 1RM for an exercise
- The Epley 1RM formula (`file:src/lib/epley.ts`) is the sole comparison metric for all exercise types
- Duration sets are hardcoded to `was_pr: false` in `file:src/lib/syncService.ts` (line 496)
- The `was_pr` boolean is persisted in `set_logs` and used by the `pr_count` achievement metric in `check_and_grant_achievements` RPC

**Pain points:**
| Pain | Impact |
|---|---|
| First-ever set on any exercise = instant PR | Inflates Record Hunter achievement track (50+ "PRs" from just trying exercises once). Cheapens the PR celebration. |
| Bodyweight exercises can never PR | `computeEpley1RM(0, reps)` returns 0 — condition `estimatedOneRM > runningBest` is always `0 > 0 = false`. Entire exercise category excluded. |
| Duration exercises hardcoded to no PR | Plank, dead hang, wall sit — users who train isometric holds get zero recognition. |
| Race condition on `best1RMReady` | If the `useBest1RM` query hasn't resolved when user taps "done", `wasPr` is forced `false`. Fast tappers lose legitimate PRs. |
| Historical `was_pr` data is corrupt | Past set_logs contain inflated PR flags (first-ever sets) and missing ones (bodyweight/duration). Achievement counts are wrong. |

---

## Goals

| Goal | Measure |
|---|---|
| Type-aware PR detection | Weighted → Epley 1RM; bodyweight (weight=0) → reps; duration → seconds |
| Eliminate first-ever inflation | PRs only after the user has **finished at least one prior session** that included that exercise (entire first session = baseline; no PRs on any set in that session) |
| Retroactive correctness | Full backfill of `was_pr` across all historical `set_logs` |
| Achievement re-grant | Record Hunter badges recalculated after backfill with correct `pr_count` |
| Fix race condition | PR detection works even if historical best query is still loading |

---

## Scope

**In scope:**

1. **`useBest1RM` → `useBestPerformance` refactor**
   - Accept exercise metadata (`measurement_type`, `equipment` from `exercises` / library) as parameters
   - Return `{ value: number, hasPriorSession: boolean }` instead of just a number (`hasPriorSession` = user has at least one **other** finished session with this exercise before the current one)
   - For **duration** (`measurement_type === "duration"`): return best `duration_seconds` from history
   - For **bodyweight equipment** (`equipment === "bodyweight"`): return best **reps** (ignore added weight for PR — avoids broken Epley on tiny loads; aligns with out-of-scope note on hybrid metrics)
   - For **all other equipment** on rep-based sets: return best estimated 1RM (existing Epley logic on `weight_logged` + reps)

2. **`SetsTable.tsx` PR logic overhaul**
   - Gate PRs behind `hasPriorSession === true` (no PRs on any set during the user’s **first session** that includes this exercise)
   - Route to the correct comparison per exercise type:
     - Weighted: `estimatedOneRM > runningBest`
     - Bodyweight: `reps > runningBest`
     - Duration: `durationSeconds > runningBest`
   - Handle the `best1RMReady` race condition (defer PR check if query not ready, or prefetch)

3. **`syncService.ts` update**
   - Stop hardcoding `was_pr: false` for duration sets
   - Accept computed `wasPr` from the duration completion callback (`completeDurationSet`)
   - Update `SetLogPayload` types to unify the `wasPr` field across reps and duration payloads

4. **`completeDurationSet` callback in `SetsTable.tsx`**
   - Wire up PR detection for duration sets (currently absent — only `confirmRir` does PR checks)
   - Track `sessionBest` for duration exercises (best seconds in current session)

5. **`sessionBest1RMAtom` generalization**
   - Rename or generalize to track the session-best value per exercise regardless of type
   - Stores 1RM for weighted, reps for bodyweight, seconds for duration

6. **SQL backfill migration**
   - Replay all `set_logs` per user per exercise in chronological order (join `exercises` for `measurement_type` + `equipment`)
   - Recalculate `was_pr` using the new type-aware logic
   - **First-session baseline:** all sets belonging to the user’s **earliest session** (by time) that contains that exercise are never PRs; from the second such session onward, apply strict ordering vs running best
   - Wipe `user_achievements` rows only for tiers in `record_hunter`, then run `check_and_grant_achievements` per user (or equivalent) so Record Hunter matches corrected `pr_count`

7. **Existing tests**
   - Update `file:src/hooks/useBest1RM.test.tsx` (or rename to `useBestPerformance.test.tsx`)
   - Update `file:src/components/workout/SetsTable.test.tsx` for new PR paths
   - Update `file:src/lib/syncService.test.ts` for duration PR payloads

**Out of scope:**
- Changing the Epley formula itself (known inaccuracy above 10 reps — separate concern)
- Per-rep-range PR tracking (e.g., "best 5RM" vs "best 1RM" — future feature)
- Weighted bodyweight as a hybrid metric (e.g., bodyweight + added weight for 1RM). For V1, bodyweight exercises compare reps only. Users who train weighted variants seriously should create a separate exercise.
- UI changes to how PRs are displayed in history (existing `was_pr` flag display stays the same)
- PR notification/celebration changes (confetti, badge glow stay as-is — they just fire on correct data now)

---

## Success Criteria

- **Zero first-session PRs:** No `set_log` where `was_pr = true` AND the row belongs to the user’s first session (for that exercise)
- **Bodyweight PRs work:** Users who beat their reps record on bodyweight exercises see the PR flag
- **Duration PRs work:** Users who beat their hold time see the PR flag
- **Backfill accuracy:** After migration, `SELECT COUNT(*) FROM set_logs WHERE was_pr = true` reflects only legitimate PRs (expect significant reduction from current inflated count)
- **Record Hunter re-grant:** Achievement badges match the corrected `pr_count` per user
- **No regression on weighted exercises:** Legitimate weighted PRs (post–first-session) are preserved or correctly recomputed by the backfill; some previously flagged PRs will be cleared (first-session inflation)
- **Test coverage:** All three exercise types have dedicated unit test cases for PR detection (weighted, bodyweight, duration)

---

## Handoff notes (for Tech Plan)

- **`hasPriorSession` implementation:** Must be computable offline-friendly: either query “other finished sessions with this exercise” (needs `currentSessionId`) or derive from session ordering at enqueue time. If the historical query lags, the in-session atom (`sessionBest1RMAtom` successor) must still allow intra-session PRs once `hasPriorSession` is true.
- **Backfill join:** `set_logs.exercise_id` → `exercises.id`; handle orphaned exercise IDs (deleted library row) with a safe fallback (e.g. treat as reps + unknown equipment → conservative rules).
- **Duration payload type:** `SetLogPayloadDuration` currently has no `wasPr` field — add it when implementing `syncService` changes.
- **Related code touchpoints beyond the brief:** `file:src/pages/WorkoutPage.tsx` (resets `prFlagsAtom` / `sessionBest1RMAtom` on session lifecycle), `file:src/components/workout/ExerciseStrip.tsx` (PR badge), any chart/history consumers of `was_pr`.
