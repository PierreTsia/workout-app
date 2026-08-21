# T236 — Ungate Profil

**Status:** done on `feat/512/profil-first-class-dashboard`.

## Goal

Remove `AdminOnly` / `AdminGuard` call sites whose **only** job is hiding Profil, so a non-admin gets the **wired** dashboard. Last ticket in the epic. Addresses Epic stories 3, 24.

## Mode

HITL — second eyeball: **wired** fold on real data (honest empties, no fixture switch, no forbidden RPC bindings) before the guard comes off. Mocked screens were T237 (**passed**). This ticket is not a second T237.

## Slice

HITL dogfood checklist → delete Profil `AdminOnly` / `AdminGuard` → drawer visible to all signed-in users → `/profile` no longer redirects home → vitest (non-admin can render) → drop T0 fixture switch

## Dependencies

T227–T234 (all blocks wired, including Toujours). T224–T226 and T237 are already done. T235 (copy-deck canvas) does not block ungate. T226 write path is shipped; **run `scripts/backfill-was-pr.ts --apply` on production** (or accept lag on old Circuit rows) before merge.

## Scope

### HITL checklist (human, before the PR)

- [x] 7j / 30j / 100j / 1 an / Toujours on your account: no crash, empties ≠ loading
- [x] Pulse is not pause-inclusive `minutes`
- [x] Records can disagree with `get_cycle_stats` and still look right
- [x] Cindy Mix = Circuits and Tonnage 0 t
- [x] Fixture / empty / loading **admin switch is gone**
- [x] Account still has PAT / DELETE / questionnaire; no `/account` → `/profile` redirect

### Code

- Drawer Profil row is a normal signed-in link (`file:src/components/SideDrawer.tsx`)
- `/profile` sits next to `/achievements` under AppShell, not `AdminGuard` (`file:src/router/index.tsx`)
- `/_profile-charts` stays admin-gated
- T0 fixture switch removed from `file:src/pages/ProfilePage.tsx`. Tests use `ProfileDashboard` for empty/loading; the route component is always live-shaped.

### Tests

- Signed-in non-admin: nav row present (`file:src/components/SideDrawer.test.tsx`)
- `/profile` is not nested under `AdminGuard` (`file:src/pages/ProfilePage.test.tsx`)

## Out of Scope

- Settings split / `/settings`
- Public profile
- History rewrite
- Any new aggregation
- Polishing `ProfileSection` error chrome (`profile.error` one-liner)
- Applying snapshot / ledger / all-time RPCs to prod (still local-only at ungate)

## Acceptance Criteria

- [x] Zero remaining `AdminOnly` / `AdminGuard` call sites whose only job is hiding Profil
- [x] Non-admin can open `/profile` and see live (not fixture) blocks
- [x] Account flows unchanged
- [x] Demoable: a signed-in non-admin reaches the three acts
- [x] Env-stripped vitest for the router/nav assertions + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 3, 24, success measure 24
- Tech Plan: ungate last
