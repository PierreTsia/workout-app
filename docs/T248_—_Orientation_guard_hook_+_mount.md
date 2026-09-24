# T248 — Orientation guard hook + mount

**Epic:** `file:docs/Epic_Brief_—_Session_Portrait_Guard_#501.md` · **Tech Plan:** `file:docs/Tech_Plan_—_Session_Portrait_Guard_#501.md`

- **Mode:** AFK — every decision is pinned in the Tech Plan (predicate, mount point, silent-failure posture).
- **Slice:** `sessionAtom → useSessionOrientationGuard → AppShell mount → <html> class/attr + screen.orientation → vitest (unit + integration)`
- **Dependencies:** None

## Goal

Deliver the activation half of the **Session Portrait Guard**: while a **Session** is live or paused, `<html>` carries `gl-session-orientation-guard` (plus `data-gl-rot` when landscape) and a best-effort portrait OS lock is attempted — stories 1, 3, 4, 6, 8.

## Scope

- New `file:src/hooks/useSessionOrientationGuard.ts`:
  - Predicate: `sessionAtom.isActive && session.startedAt != null` (the **SessionTimerChip** / `cancelSession` predicate).
  - Activate: add class `gl-session-orientation-guard` to `document.documentElement` via `classList` (never `className` — coexist with the theme script's classes, `file:index.html:62-98`); attempt `screen.orientation.lock("portrait")` guarded by `typeof …?.lock === "function"`, errors swallowed (`.catch(() => {})` + try/catch); write `data-gl-rot` from `screen.orientation.angle` (`> 0 && < 180` ⇒ `"-90"`, else `"90"`; fallback `window.orientation`, default `"-90"`).
  - Orientation change while active: re-derive `data-gl-rot` (listen `screen.orientation` `change` when available, plus `window` `orientationchange`).
  - Deactivate / unmount: remove class + attribute; `screen.orientation.unlock()` inside try/catch.
  - StrictMode-safe: idempotent adds, symmetric cleanup (mirror `file:src/hooks/useKeepScreenAwake.ts`).
- Mount the hook once in `file:src/components/AppShell.tsx` (alongside existing session chrome).
- Tests:
  - `file:src/hooks/useSessionOrientationGuard.test.ts` — patterns from `file:src/hooks/useKeepScreenAwake.test.ts`: `renderHook`/`act`/`waitFor` from `@testing-library/react`, `vi.stubGlobal("screen", …)`, `afterEach(() => vi.unstubAllGlobals())`. Cases: inactive ⇒ no class, no lock; active ⇒ class + exactly one lock attempt; lock rejects ⇒ no unhandled rejection; lock undefined ⇒ no throw; deactivate/unmount ⇒ class removed + unlock called; orientation change ⇒ `data-gl-rot` follows angle.
  - `file:src/components/AppShell.test.tsx` — integration: `getDefaultStore().set(sessionAtom, {… isActive: true, startedAt: Date.now() …})` ⇒ class present; reset ⇒ absent.

## Out of Scope

- Any CSS rotation (that is T249 — this ticket must not touch `globals.css`).
- Manifest changes, Floor HUD, i18n, ADR/glossary (T250).

## Acceptance Criteria

- [ ] `useSessionOrientationGuard()` adds `gl-session-orientation-guard` iff predicate true, removes it iff false / unmount.
- [ ] Exactly one `screen.orientation.lock("portrait")` attempt per activation; `unlock()` on deactivation.
- [ ] Rejecting `lock()` and missing `lock` both produce zero thrown errors / unhandled rejections.
- [ ] `data-gl-rot` set to `-90`/`90` per angle rules while active; removed on deactivation.
- [ ] AppShell integration: class present on `<html>` exactly while a live session exists in the store.
- [ ] `npm test`, `npm run lint`, `npm run build` green.
- [ ] Demo: start a session in the app → `document.documentElement.classList.contains("gl-session-orientation-guard")` is `true` in devtools; finish → `false`.

## References

Epic Brief stories 1, 3, 4, 6, 8 · Tech Plan §Key Decisions, §Component Architecture, §Testing, §Failure Mode Analysis rows 1–7, 9–10.
