# T249 — Landscape rotate CSS fallback

**Epic:** `file:docs/Epic_Brief_—_Session_Portrait_Guard_#501.md` · **Tech Plan:** `file:docs/Tech_Plan_—_Session_Portrait_Guard_#501.md`

- **Mode:** AFK — CSS is fully specified (gates, geometry, overrides) in the Tech Plan; only the final phone-eyeball is manual.
- **Slice:** `globals.css guard block → live landscape rotation of <html> (covers #root, sonner, Radix/vaul portals) → manual coarse-pointer check`
- **Dependencies:** T248 (the class and `data-gl-rot` the CSS keys on)

## Goal

When the guard is active and the device reports landscape on a coarse pointer, render the app in an upright portrait visual instead of the broken reflow — stories 2, 5, 7.

## Scope

- One **plain (unlayered)** CSS block in `file:src/styles/globals.css` (style of the existing achievement rules at `:266-412`; no `@layer`, no `!important`), gated by `@media (orientation: landscape) and (pointer: coarse)` **and** `html.gl-session-orientation-guard`:
  - Swap html box: `width: 100vh; height: 100vw; background: <theme bg #0f0f13>; transform-origin: top left`.
  - `data-gl-rot="-90"` ⇒ `transform: translateY(100vh) rotate(-90deg)`.
  - `data-gl-rot="90"` ⇒ `transform: translateX(100vw) rotate(90deg)`.
  - Viewport-unit fixes: `body { height: 100% }`, `.h-dvh { height: 100% }`, `.min-h-dvh { min-height: 100% }` (Tailwind v4 utilities are layered — unlayered wins).
- Do **not** transform `<body>` (vaul's inline body transform must compose inside the html transform — Tech Plan §Critical Constraints).
- No component, hook, or test changes (CSS is verified structurally + manually).

## Out of Scope

- Changing T248's hook or predicate.
- Playwright landscape e2e (config is desktop-only; out of the epic).
- Drawer `shouldScaleBackground` tweaks — accepted cosmetic risk (Failure Mode 8).

## Acceptance Criteria

- [ ] On a coarse-pointer landscape viewport with the class present, `<html>` has the swapped dimensions + ±90 transform matching `data-gl-rot`, and the session shell fills the screen upright (no portrait→landscape reflow of `WorkoutPage`).
- [ ] Same viewport **without** the class (pre-session, desktop-style pointer, session finished) ⇒ zero transform — app behaves as today (stories 3, 4, 5).
- [ ] Portrait orientation with class present ⇒ media query inert, zero transform.
- [ ] Inside the rotated state, `AppShell`'s `h-dvh` fills the portrait box (no half-empty shell).
- [ ] With a Radix/vaul portal open (e.g. RIR drawer) while rotated, the portal content sits inside the rotated portrait box.
- [ ] Desktop landscape (fine pointer) ⇒ no transform even with the class.
- [ ] `npm run lint`, `npm run build` green; `npm test` unaffected.
- [ ] Manual: phone in landscape during a live session shows upright portrait UI (note result in the PR).

## References

Epic Brief stories 2, 5, 7 · Tech Plan §Key Decisions (rotate tactic, viewport-unit fix), §Component Architecture CSS contract, §Failure Mode Analysis rows 3–4, 8, 11–13.
