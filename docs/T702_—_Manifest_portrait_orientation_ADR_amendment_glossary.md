# T702 — Manifest portrait orientation + ADR 0022 amendment + glossary

**Epic:** `file:docs/Epic_Brief_—_Session_Orientation_Guard_app-wide_#701.md` · **Tech Plan:** `file:docs/Tech_Plan_—_Session_Orientation_Guard_app-wide_#701.md`

- **Mode:** AFK — config + docs.
- **Slice:** `vite.config.ts manifest → ADR 0022 amendment → CONTEXT.md term`
- **Dependencies:** none (parallel to T701)

## Goal

Promote the prevention to the OS level (app-wide) and record the reversal of #501's "no manifest" decision and its stale iOS premise.

## Scope

- Add `orientation: "portrait"` to the `VitePWA` manifest in `file:vite.config.ts`.
- Amend `file:docs/adr/0022-session-orientation-policy.md`: withdraw decision 3b (CSS rotate fallback), reverse decision 4 (manifest untouched), correct the "iOS ignores every lock API" premise (Safari iOS 16.4+ supports `screen.orientation`), add an amendment note with the #701 date.
- Rewrite the **Session Orientation Guard** term in `file:docs/CONTEXT.md` without the CSS layer; mention the manifest.

## Out of Scope

- Code/tests (T701).
- Responsive landscape polish.

## Acceptance Criteria

- [ ] `vite.config.ts` manifest declares `orientation: "portrait"`.
- [ ] ADR 0022 reflects the new tactic and no longer claims iOS ignores all locks.
- [ ] `docs/CONTEXT.md` **Session Orientation Guard** matches the implementation.
- [ ] `npm run lint` green.

## References

Tech Plan §Key Decisions, §ADR Amendment Summary.
