# Epic Brief — RIR Tracking & Auto-Suggestion for Load Progression

## Summary

This epic adds a Reps in Reserve (RIR) input to the set completion flow — a 5-level effort scale (0 to 4+) presented in a bottom sheet right after checking off a set. The logged RIR is persisted to `set_logs` and feeds a deterministic suggestion engine that auto-fills weight/rep values for subsequent sets (both within the same workout and across sessions). The input is always-present but zero-friction: a default is pre-selected so dismissing is one tap. Suggestions are always editable — the user stays in full control. This turns progressive overload from guesswork into a data-driven feedback loop.

---

## Context & Problem

**Who is affected:** All users who log sets during a workout session.

**Current state:**

- Users complete sets via a checkbox in `file:src/components/workout/SetsTable.tsx` — no effort data is captured beyond reps and weight
- The `set_logs` table stores `reps_logged`, `weight_logged`, `estimated_1rm`, `was_pr` — no subjective difficulty signal
- Load progression is pure guesswork: users must remember how a set *felt* and decide whether to adjust
- Checking a set triggers the rest timer immediately (`file:src/components/workout/RestTimerOverlay.tsx`) — there is no interaction point between "done" and "rest"
- The Epley 1RM formula (`file:src/lib/epley.ts`) provides a mathematical proxy, but two sets can have identical 1RM estimates yet feel completely different (grinder vs. smooth)

**Pain points:**

| Pain | Impact |
|---|---|
| No effort tracking | Users can't systematically gauge set difficulty, making progressive overload inconsistent |
| Load guesswork | Over- or under-loading because there's no structured signal for when to adjust |
| No pre-rest interaction point | Lost opportunity to capture per-set data while the experience is fresh |
| 1RM alone is blind to effort | Estimated 1RM doesn't distinguish a set at failure from a comfortable set |

---

## Goals

| Goal | Measure |
|---|---|
| Capture per-set effort data | >= 60% of logged sets include a deliberate RIR selection (user changed the default) within 4 weeks of launch |
| Reduce load guesswork | 100% of sets following an RIR-logged set display an auto-filled suggestion |
| Cross-session progression | When starting an exercise that has RIR history from a prior session, weight/rep inputs are pre-filled with a progression suggestion |
| Zero friction for uninterested users | Dismissing the RIR sheet is one tap (default pre-selected); adds < 1s to set completion flow |
| Practical suggestions | Weight suggestions always resolve to real plate increments (2.5 kg / 5 lbs) |

---

## Scope

**In scope:**

1. **RIR bottom sheet** — slides up after checking a set as done, *before* the rest timer starts. Five color-coded circle buttons: 0 (red, Maximum), 1 (orange, Very Hard), 2 (yellow, Hard), 3 (green, Moderate), 4+ (blue, Easy). **Default pre-selected: 2 ("Hard")** — so dismissing ("Confirm") is a single tap. Context line shows set number and reps x weight. An info icon (i) opens a tooltip explaining what RIR means for first-timers.

2. **Schema: `rir` column on `set_logs`** — `smallint, nullable`. Values 0–4 (where 4 represents "4+"). Nullable for backward compatibility with historical data. Single `ALTER TABLE` migration, no data backfill.

3. **Modified set completion flow** — the current flow is: checkbox → update state + enqueue set log + start rest timer (all synchronous in `toggleDone()`). The new flow inserts the RIR sheet between checkbox and rest timer: checkbox → mark set pending → open RIR sheet → user confirms → enqueue set log (with RIR) + start rest timer. If the user unchecks a completed set, the stored RIR for that set is cleared.

4. **Intra-session suggestion engine** — after logging RIR on set N, auto-fill set N+1 of the same exercise. The primary signal within a single workout is fatigue management (RIR naturally decreases set-to-set), not load progression:

   | RIR | Label | Next set suggestion |
   |---|---|---|
   | 0 | Maximum (failure) | Reduce weight by 1 increment (2.5 kg / 5 lbs) |
   | 1 | Very Hard | Same weight, same reps |
   | 2 | Hard (sweet spot) | Same weight, same reps |
   | 3 | Moderate | Same weight, same reps (current weight is fine) |
   | 4+ | Easy | Increase weight by 1 increment (2.5 kg / 5 lbs) |

   RIR 4+ on an early set means the user started too light — bumping by one increment is warranted. RIR 0 means they hit failure — dropping one increment prevents a forced reduction in reps. RIR 1–3 all suggest holding steady, which matches standard straight-set training. The engine is a pure function, fully unit-testable. Weight increments respect the user's unit preference (`weightUnitAtom`).

   **Last-set behavior:** RIR is still collected on the final set of an exercise (valuable for cross-session data), but no intra-session suggestion is generated since there's no subsequent set.

5. **Cross-session suggestion engine** — when initializing sets for a workout, for each exercise that has RIR data from a completed prior session, compute a suggestion based on the average RIR across all sets of that exercise in the most recent session:

   | Avg RIR (last session) | Suggestion |
   |---|---|
   | < 1.5 | Same weight as last session (near failure — consolidate before progressing) |
   | 1.5 – 2.5 | +1 increment (2.5 kg / 5 lbs) — sweet spot, ready for small progression |
   | > 2.5 | +2 increments (5 kg / 10 lbs) or +1–2 reps — too easy, bigger jump warranted |

   Suggestions auto-fill the weight/rep inputs but remain fully editable. Cross-session suggestions are the primary driver of progressive overload; intra-session suggestions handle fatigue.

6. **Suggestion visual indicator** — auto-filled values appear directly in the weight/reps inputs (no separate badge). In Phase 2, a subtle visual cue (e.g. tinted input border) distinguishes auto-suggested values from manual ones, so the user knows a suggestion was applied.

7. **i18n** — all new strings in EN and FR: bottom sheet title ("Reps in Reserve" / "Répétitions en réserve"), scale labels (Maximum, Very Hard, Hard, Moderate, Easy), info tooltip content, confirm button text.

8. **Analytics events** — `rir_logged` (with exercise_id, set_number, rir_value, was_default flag), `rir_suggestion_accepted` (user kept auto-filled values), `rir_suggestion_overridden` (user changed them). Via the existing `useTrackEvent` hook and `analytics_events` table.

**Out of scope:**

- RIR trend charts or history visualization (deferred to a future analytics/profile epic)
- RIR averages in session summary
- Settings toggle to disable RIR (the one-tap default dismiss makes this unnecessary for V1 — revisit if user feedback indicates friction)
- Adaptive or ML-based suggestion engine (deterministic rules only)
- Per-equipment increment tables (V1 uses uniform 2.5 kg / 5 lbs; equipment-specific rounding deferred)
- RPE (Rate of Perceived Exertion) or alternative effort scales
- Per-exercise RIR targets ("aim for RIR 2 on compounds, RIR 3 on isolations")
- Deload week detection or periodization awareness
- Suggestion differentiation by exercise type (compound vs. isolation)

---

## Delivery Phases

**Phase 1 — RIR Input + Intra-Session Suggestions**

- Migration: add `rir smallint` column to `set_logs`
- TypeScript types: extend `SetLog`, set log payload, and local session state to carry `rir`
- `RirBottomSheet` component (color-coded scale, pre-selected default, info tooltip, context line)
- Refactor set completion flow: insert RIR sheet between checkbox and rest timer
- Intra-session suggestion engine (pure function + unit tests)
- Auto-fill next set inputs with suggested values
- Handle unchecking: clear stored RIR for that set
- i18n strings (EN/FR)

**Phase 2 — Cross-Session Suggestions + Analytics**

- Query hook to fetch the most recent session's RIR data for a given exercise
- Cross-session suggestion engine (pure function + unit tests)
- Pre-fill set inputs on workout initialization when prior RIR history exists
- Analytics events: `rir_logged`, `rir_suggestion_accepted`, `rir_suggestion_overridden`
- Visual indicator on auto-suggested inputs (subtle border tint or icon)
- Edge cases: first-ever set of an exercise (no history), exercise done in a previous/different program, long gaps between sessions (> 4 weeks)

---

## Success Criteria

- **Numeric:** >= 60% of sets logged after launch include a non-default RIR selection (tracked via `was_default` flag in analytics)
- **Numeric:** 100% of sets following an RIR-logged set have their weight/reps auto-filled with a suggestion
- **Numeric:** RIR sheet interaction adds < 500ms to the set completion flow compared to the current direct-to-rest-timer path
- **Qualitative:** A user unfamiliar with RIR understands the scale via the labeled color-coded buttons and info tooltip
- **Qualitative:** Dismissing the sheet without changing the default is effortless (one tap, zero cognitive load)
- **Qualitative:** Suggestions always resolve to real plate increments — never fractional values like "81.37 kg"
- **Qualitative:** Suggestions never block the user — inputs are always editable regardless of whether a suggestion was applied

---

## Dependencies

- **Set completion & sync pipeline:** The RIR sheet intercepts the existing checkbox → rest timer flow in `file:src/components/workout/SetsTable.tsx` and extends the set log payload in `file:src/lib/syncService.ts`. This is the primary integration surface.
- **Weight unit system:** The suggestion engine must respect the user's unit preference (`kg` / `lbs`) via `file:src/hooks/useWeightUnit.ts` for increment rounding.
- **Analytics infrastructure:** RIR events reuse the existing `analytics_events` table and `useTrackEvent` hook — no new infrastructure needed.

---

## Open Questions

- Should the default RIR (2) adapt based on the user's training goal from their profile? Strength-focused users typically train at RIR 0–1, making a default of 2 slightly inaccurate for quick dismissals. Universal default is simpler; goal-aware default is more accurate. Leaning toward universal default for V1.
- How should cross-session suggestions handle long gaps (> 4 weeks since last session with that exercise)? Options: apply suggestions normally, decay confidence, or skip suggestions entirely. Deferred — apply normally for V1 and revisit based on user feedback.
- Whether a one-time educational overlay on first RIR encounter adds value beyond the persistent info icon. Leaning toward info icon only (simpler, less intrusive).
