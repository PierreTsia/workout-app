# Tech Plan — Session Orientation Guard, app-wide, no CSS hack (#701)

> Implements `file:docs/Epic_Brief_—_Session_Orientation_Guard_app-wide_#701.md`. Amends ADR `file:docs/adr/0022-session-orientation-policy.md`. Glossary: `file:docs/CONTEXT.md` (**Session**, **Session Orientation Guard**).

---

## Architectural Approach

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Kill the blink | Delete the `@media (orientation: landscape) and (pointer: coarse)` guard block in `file:src/styles/globals.css` | The transform hack is the sole source of the blink and black band (reflow-then-rotate). Nothing else consumes the block. |
| OS-level prevention | Add `orientation: "portrait"` to the VitePWA manifest (`file:vite.config.ts`) | App-wide, honoured by **Android** installed PWAs. The cleanest "hold portrait" lever available to a web app; **iOS ignores it** (no manifest, no `lock()`). |
| Session-scoped reinforcement | Keep `useSessionOrientationGuard`, reduced to `screen.orientation.lock("portrait")` / `unlock()` | Reinforces the manifest on Android during the training beat; best-effort, silent (mirrors `useKeepScreenAwake`). Not a general browser-tab lever — `lock()` typically needs fullscreen / installed-standalone. |
| DOM contract | The hook touches **nothing** on `<html>` | No consumer remains once the CSS block is gone. Removing the class/attribute/listeners deletes dead surface. |
| Graceful degradation | If the platform refuses the lock, the app shows its normal landscape layout | The two acceptable ends of the athlete's ask; never the in-between. |
| ADR | Amend `0022` in place (status stays Accepted, add an amendment note) | The policy is the same fork (Prevent); only the *tactic* changes. The stale iOS premise is corrected. |

### Critical Constraints

**No transform on `<html>` anywhere.** After this change, grep over `src/` must find no `gl-session-orientation-guard`, no `data-gl-rot`, no root `transform` for orientation (the hook test keeps the two names only as negative assertions).

**StrictMode symmetry.** `file:src/main.tsx` wraps in `StrictMode` — lock/unlock must stay idempotent with symmetric cleanup (unchanged from #501's hook).

**Silent failure is a feature.** `lock()` is absent on iOS and can reject (needs fullscreen); both paths must stay noise-free (keep the try/catch + `.catch(() => {})`).

**Manifest is app-wide.** The manifest field applies outside sessions too — an accepted, explicit consequence of the athlete's "prevent the rotation" choice.

---

## Data Model

No schema, no atoms, no DOM state. The hook becomes a pure side-effect:

```ts
export function useSessionOrientationGuard(): void
```

- active (`sessionAtom.isActive && startedAt != null`) ⇒ `try { void screen.orientation?.lock?.("portrait")?.catch(() => {}) } catch {}`
- cleanup ⇒ `try { screen.orientation?.unlock?.() } catch {}`

---

## Component Architecture

| File | Change | Responsibility |
|---|---|---|
| `src/styles/globals.css` | edit | Delete the whole Session Portrait Guard block + its comment. |
| `vite.config.ts` | edit | Add `orientation: "portrait"` to the manifest. |
| `src/hooks/useSessionOrientationGuard.ts` | edit | Strip class/attribute/listeners; keep best-effort lock/unlock. |
| `src/hooks/useSessionOrientationGuard.test.ts` | edit | Assert lock/unlock lifecycle only; drop class/`data-gl-rot` cases. |
| `src/components/AppShell.test.tsx` | edit | Drop the guard-class integration assertion (mount still covered by the hook test). |
| `docs/adr/0022-session-orientation-policy.md` | edit | Amendment note: CSS rotate fallback removed; manifest orientation added; iOS premise corrected. |
| `docs/CONTEXT.md` | edit | Rewrite the **Session Orientation Guard** term without the CSS layer. |

---

## Failure Mode Analysis

| # | Scenario | Behavior |
|---|---|---|
| 1 | iOS (standalone or browser) | `lock()` unsupported and manifest `orientation` ignored ⇒ normal landscape layout, no blink. |
| 2 | Old iOS / browser tab | Lock refused silently ⇒ normal landscape layout, no blink. |
| 3 | Android installed PWA | Manifest `orientation: portrait` holds portrait app-wide. |
| 4 | Desktop | No transform exists anymore; nothing to gate. |
| 5 | Session finish / cancel | `unlock()`; manifest still app-wide (accepted). |

---

## Testing

| Case | Assertion |
|---|---|
| Active session | `lock("portrait")` called exactly once; **no** class on `<html>`; **no** `data-gl-rot`. |
| Inactive / startedAt null | `lock` never called. |
| Deactivate / unmount | `unlock()` called. |
| `lock` rejects / undefined | No throw, no unhandled rejection. |

Commands: `npm test`, `npm run lint`, `npm run build`. Manual phone pass stays HITL (Playwright is desktop-only).

---

## ADR Amendment Summary

- **Status:** Accepted (amended 2026-10-19). **Decided in:** [#701](https://github.com/PierreTsia/workout-app/issues/701).
- **What changed:** Decision 3b (CSS rotate fallback) is **withdrawn** — it blinked. Replaced by manifest `orientation: "portrait"` + best-effort lock only. Decision 4 (manifest untouched) is **reversed** for app-wide prevention.
- **Premise check:** "iOS ignores every lock API" holds for `lock()` — `ScreenOrientation.lock()` is **not supported** on Safari iOS (only the interface, `angle`, `type` and the `change` event landed in 16.4); Safari also ignores the manifest `orientation`. iOS is uncovered; Android is prevented.
- **Unchanged:** Prevent fork, not Floor HUD; **Eyes-off Feedback** owns the eyes-off story.
