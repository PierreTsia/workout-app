# ADR 0029 — Inactivity guard: 15 min of hidden time, not an immediate auto-pause

- **Status:** Accepted
- **Date:** 2026-10-06
- **Decided in:** grilling session for [#664](https://github.com/PierreTsia/workout-app/issues/664)

## Context

[#655](https://github.com/PierreTsia/workout-app/issues/655) made the **Session**
timer auto-pause the moment the app went hidden (`visibilitychange` → `hidden`),
folding the whole background span into `accumulatedPause` on return. The intent
was to stop a forgotten session from inflating `active_duration_ms` — production
carried six sessions over 12 h, up to 19 h.

The rule was too blunt. A phone-in-pocket rest, a screen lock, or a quick app
switch is part of training: the athlete is still mid-session, and the rest timer
is still counting. Excluding every hidden span erased that time from both the
session and the rest. The timer values were already timestamp-based
(`Date.now()`), so only the *exclusion rule* was wrong, not the clock.

## Decision

We will:

1. **Replace the immediate auto-pause with a 15-minute hidden-time guard.** The
   app is still paused on `hidden` (so the UI and the rest timer freeze), but on
   return the guard resolves the pause: a hidden span of **15 min or less
   counts** toward `active_duration_ms`; a span **longer than 15 min is excluded
   whole** (the entire interval from the moment it went hidden). The threshold is
   `VISIBILITY_GUARD_MS = 15 * 60 * 1000` in `src/lib/session.ts`.
2. **Measure hidden time only**, never foreground idleness. The guard reads
   `now − pausedAt` at the moment of return; no timer runs while backgrounded
   (mobile OSes freeze `setTimeout`, which is exactly the case being fixed).
3. **Auto-resume only a guard-placed pause.** `pausedByVisibility` marks the
   pause as the guard's; `resumeSessionFromVisibilityPause` no-ops on a manual
   pause, so a user's pause is never overwritten.
4. **Make the rest timer count a short hidden span too.** `RestState` gains
   `pausedForVisibility`; on resume the rest folds the pause only when it is a
   manual session pause or the span exceeds the threshold. A rest that finished
   in the background shows as finished on return, without restarting.
5. **Force a tick on `visibilitychange` → `visible`** for both the session timer
   (`SessionTimerChip`) and the rest timer (`useRestTimer`), so the displays
   recalc from the timestamp immediately. The rest tick also fires the
   finish alert best-effort — **no Web Push in v1**.
6. **Leave the 3 h orphan self-heal unchanged** (`orphanSessionClose.ts`,
   `ORPHAN_SESSION_THRESHOLD_MS`). It handles a different failure (a close that
   never landed), not a long-but-live session.

## Consequences

- **Positive:** a short background span is session + rest time again; a long
  abandonment is still excluded; a manual pause survives; the displays are never
  stale on return; no schema change, no migration, no new dependency.
- **Negative / accepted:**
  - The guard is evaluated on return, so a session killed while hidden relies on
    the persisted `pausedByVisibility` to resolve at the next mount; a span that
    crosses the threshold while the tab is dead is resolved on reopen, not at the
    exact 15-minute mark.
  - A rest longer than 15 min hidden is excluded (folded) rather than counted;
    rest durations are far below that in practice.
  - The alert is best-effort: if the OS never wakes the page, the cue arrives on
    return, not at T-0.
- **Follow-ups:** Web Push for the rest-finished alert is explicitly out of v1;
  `DurationSetTimer` and `BlockClock` are out of scope.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Keep the immediate auto-pause (#655) | Erases a phone-in-pocket rest from both timers; the reported bug. |
| A `setTimeout` armed on `hidden` | Frozen by mobile OSes while backgrounded — the exact case being fixed. |
| Exclude only the portion beyond 15 min | The decision is all-or-nothing: a span is either a rest (counts) or an abandonment (excluded whole). |
| Measure foreground idleness too | Out of scope; the guard is about hidden time, not attention. |
| Web Push for the rest alert | v1 keeps the alert best-effort; no push infrastructure. |
