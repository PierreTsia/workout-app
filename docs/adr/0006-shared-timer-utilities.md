# ADR 0006 — Shared Timer Utilities

- **Status:** Accepted
- **Date:** 2026-05-27
- **Decided in:** grilling session for #374 hold timer eyes-off feedback

## Context

The PWA has two independent timers — the rest timer (`useRestTimer.ts`) and the **Duration Set Timer** (`DurationSetTimer.tsx`). They each rolled their own audio: the rest timer uses a module-level singleton `AudioContext` with defensive `resume()`; `DurationSetTimer` creates a fresh `AudioContext` per fire and `close()`s it. Two strategies, both correct in isolation, but iOS Safari has a hard cap on concurrent contexts — adding sequenced T-3 / T-2 / T-1 / T-0 beeps per #374 would churn four contexts in three seconds under the existing pattern.

#374 also adds a screen wake lock for the **Duration Set Timer**. The Wake Lock API is small but fiddly (sentinel-release, `visibilitychange` re-acquire, feature detection, gesture-unlock) and has a credible future caller (`useRestTimer`'s 10-second warning is silently lost when the tab/screen sleeps).

Both concerns serve the same product promise — **Eyes-off Feedback** — and benefit from the same architectural call: pull the browser-API glue out of consumer components and centralize it.

## Decision

We will:

1. Extract audio helpers into `src/lib/audio.ts`: singleton `getAudioCtx()`, primitive `playBeep(frequency, durationMs, volume)`, named cues `playWarningBeep()` (660 Hz / 150 ms) and `playFinishBeeps()` (880 → 1100 Hz two-note). Both timers route through this module.
2. Add `primeAudio()` to the same module — callers invoke it from a user-gesture handler (Play, set-log) so the singleton is unlocked under iOS Safari's gesture rule before any `setInterval`-driven playback path.
3. Unify the T-0 finish chime — `DurationSetTimer` adopts `playFinishBeeps`, replacing today's single 880 Hz blip.
4. Extract a `useKeepScreenAwake(active: boolean)` hook in `src/hooks/useKeepScreenAwake.ts` encapsulating request / release / visibilitychange / feature detection. Single consumer today (`DurationSetTimer`), shaped for `useRestTimer` to opt in later.

## Consequences

- **Positive:** consistent audio strategy app-wide (singleton, gesture-unlocked once); sequenced beeps for #374 are correct on iOS; finish chime cohesion across timers; wake-lock glue testable in isolation; future timers (AMRAP/EMOM) inherit both utilities.
- **Negative:** scope creep on #374 (refactor + feature in one PR) — accepted because the singleton pattern is load-bearing for the new sequencing. Two new files, but they replace duplicated code.
- **Follow-ups:** `useRestTimer` adopts `useKeepScreenAwake(isActive)` in a separate ticket; pre-existing `DurationSetTimer` pause-elapsed bug (raw wall-clock, not pause-aware) tracked separately.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Copy-paste audio helpers into `DurationSetTimer`, keep two AudioContext strategies | Drift makes iOS bugs harder to reason about; T-3/-2/-1 sequencing reopens iOS concurrent-context cap risk. |
| Inline wake lock logic in `DurationSetTimer` (no hook) | ~40 lines of browser-API glue mixed with UI; visibilitychange crosses concerns; harder to test; future `useRestTimer` adoption forces a re-extract. |
| Two separate ADRs (one audio, one wake lock) | Both are facets of the same call (centralize browser-API glue serving **Eyes-off Feedback**); one ADR keeps the rationale together. |
| Defer extraction to a follow-up refactor ticket | Singleton is load-bearing for the new sequencing; copy-paste forces either reinventing the singleton inline or living with 4 fresh AudioContexts in 3 seconds. |
