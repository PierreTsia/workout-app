# ADR 0022 — Session orientation policy

- **Status:** Accepted
- **Date:** 2026-09-24
- **Decided in:** HITL direction-lock on [#501](https://github.com/PierreTsia/workout-app/issues/501)

## Context

During an in-progress **Session**, the phone-on-the-floor beat (drop the phone → push → pick it up) often rotates the PWA into landscape. `WorkoutPage` is a dense portrait stack; the landscape reflow is accidental and broken, not a designed mode. The platform split makes any single lever insufficient: `screen.orientation.lock('portrait')` works on installed Android PWAs, but **iOS ignores it** (API *and* manifest `orientation`). Issue #501 explicitly forbids adding `orientation: portrait` to the manifest as a quick win — it is an app-wide product choice, and a no-op on iPhone. The two candidate v1 directions — **Prevent** (keep portrait) vs **Floor HUD** (design landscape) — are mutually exclusive. The HITL intent locked the fork: *simplest implementation, prevent the ugly landscape while training*.

## Decision

We will:

1. Ship **Prevent** as v1, not **Floor HUD**. Landscape-as-a-product-surface stays a separate, unstarted fork.
2. Scope the policy to an active **Session** only: predicate `sessionAtom.isActive && session.startedAt != null` (true while paused, false from `handleFinish` / cancel / logout), mounted in `AppShell` so it survives `WorkoutPage` unmounts. Pre-session, Home, **Builder**, History, and desktop browsing are untouched.
3. Use two layers for Prevent: **(a)** best-effort `screen.orientation.lock("portrait")` on activation (installed Android PWAs), silent on missing API / rejection — same failure posture as **Eyes-off Feedback**'s wake lock; **(b)** a CSS fallback for everywhere else (iOS): when the `<html>` guard class (`gl-session-orientation-guard`) coexists with `(orientation: landscape) and (pointer: coarse)`, swap the root box to portrait dimensions and rotate it ±90° via `data-gl-rot` so the session UI renders upright with zero reflow.
4. Leave the PWA manifest without an `orientation` field. If an app-wide lock is ever wanted, that is its own product decision, not a rider on #501.
5. Keep **Eyes-off Feedback** as the eyes-off story (audio + wake lock for **Duration Set Timer**). The guard adds no audio, no notifications, no new wake-lock work.

## Consequences

- **Positive:** The floor-drop beat stops trashing the UI on both platforms; one hook + one CSS block + one attribute — nothing to translate, nothing in the schema.
- **Negative:** The CSS layer is inherently a transform hack: `100dvh` consumers inside the rotated box need overrides (only `AppShell`'s `h-dvh` today); vaul drawer scale composes but may read slightly odd; when the orientation angle is unreadable the default rotation can land content upside-down until the phone returns to portrait.
- **Follow-ups:** **Floor HUD** remains the other fork — grill before any Epic Brief. Visual verification on a real iPhone/Android is a manual pass (Playwright here is desktop-only). If the rotate fallback ever proves too fragile, the designed-landscape-**nudge** overlay is the cheap fallback of last resort.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Floor HUD** (designed landscape surface) | The other v1 fork; needs park-vs-glance product grilling we resolved as *park* — nobody looks mid-set (**Eyes-off Feedback**). |
| Manifest `orientation: portrait` | App-wide, not session-scoped; explicitly forbidden as a quick win in #501; no-op on iOS. |
| CSS freeze without rotate (fixed portrait width) | Portrait content is taller than the landscape viewport — it would crop, not fit. |
| Designed "rotate your phone" nudge overlay | Prevents the ugly reflow but shows nothing useful while the phone rests mid-set; rotate keeps the whole session UI upright instead. Kept as the cheap fallback if transforms prove too fragile. |
| Full Floor HUD lite (timer-only landscape card) | Smuggles option 2 into option 1 — the issue forbids "a bit of CSS" between the two products. |
