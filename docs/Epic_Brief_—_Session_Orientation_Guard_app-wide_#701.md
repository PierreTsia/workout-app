# Epic Brief — Session Orientation Guard, app-wide, no CSS hack (#701)

## Summary

#501 shipped **Prevent** with two layers: a best-effort `screen.orientation.lock("portrait")` **and** a CSS fallback that rotates `<html>` ±90° when the device reports landscape on a coarse pointer. In practice the CSS layer is worse than either extreme: the browser reflows to landscape first, the transform snaps back after, producing a **blink** and a broken view with a **black band**. The athlete wants the two clean ends — *hold the device in portrait*, or *accept landscape* — not the flickering in-between.

This corrective keeps the **lock** layer, **removes the CSS rotate hack**, and promotes the OS-level guarantee to the **manifest** (`orientation: "portrait"`) so rotation is prevented app-wide wherever the platform allows it. Where it does not (older iOS, browser tabs), the app degrades to plain landscape — no blink, no half-drawn portrait box. ADR `file:docs/adr/0022-session-orientation-policy.md` is amended (its "iOS ignores every lock API" premise is stale: Safari iOS 16.4+ supports `screen.orientation`, per caniuse). Vehicle: [#701](https://github.com/PierreTsia/workout-app/issues/701).

---

## Context & Problem

**Who is affected:** Any athlete mid-**Session** who rotates the phone (the phone-on-the-floor beat).

**Current state:**
- `file:src/styles/globals.css` carries a `@media (orientation: landscape) and (pointer: coarse)` block that swaps `<html>` to portrait dimensions and rotates it via `transform`, keyed on a `gl-session-orientation-guard` class + `data-gl-rot` attribute.
- `file:src/hooks/useSessionOrientationGuard.ts` maintains that class/attribute and calls `screen.orientation.lock("portrait")` best-effort.
- `file:vite.config.ts` manifest has **no** `orientation` field (deliberately, per #501).

**Pain points:**

| Pain | Impact |
|---|---|
| Blink on rotation | Visible jank every time the phone tips sideways |
| Black band / broken view | The transform geometry leaves part of the viewport unpainted |
| Fragile transform hack | Geometry depends on a readable angle; upside-down content is possible (ADR 0022 consequence) |

**Premise correction:** ADR 0022 assumed iOS ignores every lock lever. caniuse now reports Safari iOS **16.4+** supports the Screen Orientation API, so a lock-only + manifest strategy is credible on the device that reported the original issue.

---

## User Stories

1. As an **athlete** on an installed PWA (Android, or iOS 16.4+), I want the device held in portrait while I train, so that tipping the phone never rotates the UI.
2. As an **athlete** on a platform that refuses the lock, I want the app to simply show its normal landscape layout, so that I never see a blink or a black band.
3. As an **athlete** who finishes / cancels a **Session**, I want the orientation policy released, so that the rest of the app behaves as today.
4. As a **desktop** user, I want no rotation hack, so that a wide monitor is never transformed.
5. As a **maintainer**, I want the CSS rotate hack gone and the policy expressed as *manifest + one best-effort lock*, so that the next reader does not mistake a fragile transform for styling.

---

## Scope

**In scope:**
- Remove the entire Session Portrait Guard CSS block from `file:src/styles/globals.css` (cause of the blink).
- Add `orientation: "portrait"` to the VitePWA manifest (`file:vite.config.ts`).
- Simplify `useSessionOrientationGuard` to `lock("portrait")` on active + `unlock()` on cleanup — no class, no `data-gl-rot`, no orientation listeners, silent failure preserved.
- Update unit/integration tests accordingly.
- Amend ADR `file:docs/adr/0022-session-orientation-policy.md` and the **Session Orientation Guard** glossary term.

**Out of scope:**
- A designed landscape surface (Floor HUD) — still its own unstarted fork.
- Responsive polish of the landscape layout (accepted as-is when the OS refuses the lock).
- Schema, new dependencies, i18n.

---

## Success Criteria

- **Numeric:** the guard CSS block no longer exists; manifest carries `orientation: "portrait"`; the hook makes zero DOM mutations on `<html>`.
- **Qualitative:** rotating the phone mid-session either keeps portrait (lock honoured) or shows the normal landscape layout — never a blink, never a black band.
- **Negative:** no `gl-session-orientation-guard` class, no `data-gl-rot`, no `transform` on `<html>` anywhere in the app.
