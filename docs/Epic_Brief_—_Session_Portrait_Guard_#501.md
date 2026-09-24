# Epic Brief — Session Portrait Guard (#501)

## Summary

During an in-progress **Session**, dropping the phone on the floor often rotates the PWA into landscape, and the portrait-only session UI reflows into an accidental, broken layout. This epic ships the **Prevent** v1: while a **Session** is live (or paused), the app keeps a usable portrait visual — best-effort OS orientation lock where the platform allows it, and a no-reflow CSS fallback where it does not (iOS). Not a Floor HUD, not a bit of "responsive CSS" — a deliberate orientation policy scoped to the training beat. GitHub [#501](https://github.com/PierreTsia/workout-app/issues/501) stays the vehicle.

**Decision record:** HITL direction-lock (2026-09-24): *« simplest implem, prevent unesthetic landscape when training session »*. Fork **Prevent** chosen over Floor HUD; **park vs glance** resolved as *park* (phone goes down during a set; **Eyes-off Feedback** already covers **Duration Set Timer** audio + wake lock). ADR `file:docs/adr/0022-session-orientation-policy.md` (written with the Tech Plan). Glossary: `file:docs/CONTEXT.md`.

---

## Context & Problem

**Who is affected:** Any athlete mid-**Session** — the phone-on-the-floor beat at the start of a set (phone down → push → phone up).

**Current state:**
- PWA manifest (`file:vite.config.ts`) is `display: standalone` with **no** `orientation` field.
- No `screen.orientation.lock` anywhere; no landscape handling in app code.
- `WorkoutPage` (route `/`, `file:src/pages/WorkoutPage.tsx`) is a dense portrait stack: sets table, **Exercise Strip**, rest timer, circuits / **Round Screen**. In landscape it reflows into an ugly, barely usable layout.
- **Eyes-off Feedback** (audio cues + `useKeepScreenAwake`) already covers **Duration Set Timer** — nobody needs to *read* the screen mid-hold.
- Platform reality: `screen.orientation.lock('portrait')` works on installed Android PWAs; **iOS ignores it** (API and manifest). On iPhone, "prevent" can only mean *don't reflow — keep a portrait visual*.

**Pain points:**

| Pain | Impact |
|---|---|
| Landscape reflow mid-set | Broken, unesthetic layout every time the phone is dropped face-up/sideways |
| No orientation policy at all | The broken state looks like a bug, not a choice |
| iOS cannot lock | A manifest-only "fix" would be a no-op for the athlete who reported it |

The original #501 body warned against adding `orientation: portrait` to the manifest as a quick win. That warning stands: the manifest is app-wide, this epic is **Session-scoped**.

---

## User Stories

1. As an **athlete** with a live **Session** on an installed Android PWA, I want the OS to hold portrait while the session is active, so that dropping the phone on the floor does not rotate the UI.
2. As an **athlete** on iOS (where the lock API is ignored), I want the session UI to stay visually portrait when the device reports landscape, so that I never see the broken reflow — the portrait layout renders upright instead.
3. As an **athlete** whose **Session** finishes, is cancelled, or is abandoned, I want the orientation guard released, so that the rest of the app (Home, **Builder**, History, desktop browsing) behaves exactly as today.
4. As an **athlete** browsing the pre-session day view on `/`, I want **no** orientation guard, so that browsing is not locked to a policy that only the training beat needs.
5. As a **desktop** user running a session on a wide monitor, I want the landscape fallback to stay off (coarse-pointer devices only), so that my desktop layout is never rotated.
6. As an **athlete** whose platform rejects the orientation lock (unsupported / denied), I want the session to proceed silently without errors, so that the guard degrades the same way **Eyes-off Feedback**'s wake lock already does.
7. As an **athlete** who gets a toast or opens a drawer (RIR, pause dialog) while the fallback is active, I want those portal surfaces to stay readable too, so that the guard does not fix the page while leaving modals ugly.
8. As a **maintainer**, I want the orientation policy recorded in an ADR and the guard expressed as one small hook + one CSS block, so that the next person does not mistake the guard for accidental styling.

### Success measures

| Story # | Measure |
|---|---|
| 1, 2 | With a live **Session** on a coarse-pointer landscape viewport, the guard class is on `<html>` and the session UI renders in a portrait-shaped box (no portrait→landscape reflow of `WorkoutPage`) |
| 1 | Session start triggers exactly one best-effort `screen.orientation.lock('portrait')`; session end triggers `unlock()` |
| 3, 4 | Guard class absent when `sessionAtom.isActive` is false and on non-session screens |
| 5 | Fallback CSS gated on `(pointer: coarse)` — no match on desktop |
| 6 | `lock()` rejection is swallowed (silent fallback); zero thrown errors in tests |
| 8 | ADR `0022` merged; guard logic lives in one hook + one CSS block, not scattered |

Stories without a numeric measure are validated qualitatively via the user story itself.

---

## Scope

**In scope:**
- `usePortraitLock` (or equivalently named) hook: best-effort `screen.orientation.lock('portrait')` / `unlock()` driven by live-session state, silent on failure — pattern-mirrors `file:src/hooks/useKeepScreenAwake.ts`.
- A session orientation guard: sets a marker class (and current orientation type) on `<html>` while the **Session** is live or paused (`sessionAtom.isActive && startedAt != null` — the same predicate as **SessionTimerChip** / `cancelSession` — mounted from `file:src/components/AppShell.tsx` so it survives `WorkoutPage` unmounts).
- CSS no-reflow fallback: under `(orientation: landscape) and (pointer: coarse)` + guard marker, render the app content in a rotated portrait box so the **Session** UI appears portrait regardless of device orientation; cover portal surfaces (sonner toasts, Radix portals) spawned while the guard is active.
- Guard applies for **live + paused** sessions (phone on the floor during rest too), released on finish / cancel / abandon / navigation away from an active session.
- Unit tests (Vitest + RTL) for the hook and guard lifecycle, in the style of `file:src/hooks/useKeepScreenAwake.test.ts`.
- ADR `file:docs/adr/0022-session-orientation-policy.md` — why Prevent, why session-scoped, why iOS forces the CSS layer, why the manifest stays untouched.
- Issue [#501](https://github.com/PierreTsia/workout-app/issues/501) stays the vehicle.

**Out of scope:**
- **Floor HUD** — a designed landscape surface is the *other* fork; explicitly not v1 (and not "a bit of CSS" between the two).
- Manifest `orientation: portrait` — app-wide product choice; the issue forbids it as a quick win; this epic is Session-scoped. (If a later epic wants app-wide portrait, that is a separate decision.)
- Pre-session day view, Home, **Builder**, History, Program Page, Library — no guard, no lock.
- Desktop landscape behavior beyond the `(pointer: coarse)` gate.
- New audio / wake-lock work — **Eyes-off Feedback** already owns that; do not duplicate.
- Circuits / **Round Screen** as a *different* surface — same guard applies, no special-casing in v1.
- Post-session **Session Summary** polish in landscape (guard is released once the session is no longer active).

---

## Success Criteria

- **Numeric:** One `screen.orientation.lock('portrait')` attempt per live-session activation; `unlock()` on deactivation; guard class present ⇔ `sessionAtom.isActive`; fallback media query includes `(pointer: coarse)`.
- **Qualitative:** The athlete drops the phone mid-push, picks it up between sets, and the session UI looks and behaves portrait — no broken reflow — on both Android (lock) and iPhone (CSS fallback).
- **Negative:** No manifest `orientation` field added. No Floor HUD surface. No behavior change outside an active **Session**. No new console noise when the lock API is missing or rejects.
