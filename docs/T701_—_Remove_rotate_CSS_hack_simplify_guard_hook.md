# T701 — Remove the rotate CSS hack, simplify the guard hook

**Epic:** `file:docs/Epic_Brief_—_Session_Orientation_Guard_app-wide_#701.md` · **Tech Plan:** `file:docs/Tech_Plan_—_Session_Orientation_Guard_app-wide_#701.md`

- **Mode:** AFK — behavior fully specified; the phone-eyeball is manual.
- **Slice:** `globals.css (delete block) → useSessionOrientationGuard (lock/unlock only) → tests`
- **Dependencies:** none

## Goal

Kill the blink: the CSS rotate fallback is the sole cause. After this ticket the hook only attempts a best-effort portrait lock and releases it — no DOM mutation on `<html>`.

## Scope

- Delete the whole `@media (orientation: landscape) and (pointer: coarse)` block and its `===== Session Portrait Guard (#501) =====` comment from `file:src/styles/globals.css`.
- Rewrite `file:src/hooks/useSessionOrientationGuard.ts`: remove `GUARD_CLASS`, `currentRot()`, class/attribute writes and orientation listeners; keep `lock("portrait")` on active and `unlock()` on cleanup, silent failure preserved.
- Update `file:src/hooks/useSessionOrientationGuard.test.ts`: assert lock/unlock lifecycle; drop class and `data-gl-rot` cases.
- Update `file:src/components/AppShell.test.tsx`: drop the guard-class integration assertion.

## Out of Scope

- Manifest change (T702).
- ADR / glossary (T702).

## Acceptance Criteria

- [ ] `src/styles/globals.css` contains no `gl-session-orientation-guard` and no orientation `transform`.
- [ ] Active session ⇒ exactly one `lock("portrait")`; `unlock()` on deactivate/unmount; no class or `data-gl-rot` on `<html>`.
- [ ] `lock` absent or rejecting ⇒ no throw, no unhandled rejection.
- [ ] `npm run lint`, `npm test`, `npm run build` green.

## References

Tech Plan §Key Decisions, §Failure Mode Analysis, §Testing.
