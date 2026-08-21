# T236 — Ungate Profil

## Goal

Remove `AdminOnly` / `AdminGuard` call sites whose **only** job is hiding Profil, so a non-admin gets the **wired** dashboard. Last ticket in the epic. Addresses Epic stories 3, 24.

## Mode

HITL — second eyeball: **wired** fold on real data (honest empties, no fixture switch, no forbidden RPC bindings) before the guard comes off. Mocked screens were T237 (**passed**). This ticket is not a second T237.

## Slice

HITL dogfood checklist → delete Profil `AdminOnly` / `AdminGuard` → drawer visible to all signed-in users → `/profile` no longer redirects home → vitest (non-admin can render) → optional drop T0 fixture switch

## Dependencies

T227–T234 (all blocks wired, including Toujours). T224–T226 and T237 are already done. T235 (copy-deck canvas) does not block ungate. T226 write path is shipped; **run `scripts/backfill-was-pr.ts --apply` on production** (or accept lag on old Circuit rows) before this ticket.

## Scope

### HITL checklist (human, before the PR)

- [ ] 7j / 30j / 100j / 1 an / Toujours on your account: no crash, empties ≠ loading
- [ ] Pulse is not pause-inclusive `minutes`
- [ ] Records can disagree with `get_cycle_stats` and still look right
- [ ] Cindy Mix = Circuits and Tonnage 0 t
- [ ] Fixture / empty / loading **admin switch is gone** or admin-only leftover is explicitly dropped in this PR
- [ ] Account still has PAT / DELETE / questionnaire; no `/account` → `/profile` redirect

### Code

- Remove drawer `AdminOnly` around Profil
- Remove route `AdminGuard` for `/profile`
- Do not remove admin tooling used elsewhere
- Delete T0 fixture switch from `ProfilePage` (or keep behind a local `?fixtures=` that is **not** shipped)

### Tests

- Signed-in non-admin: nav row present; `/profile` renders
- Signed-out: existing auth gate unchanged

## Out of Scope

- Settings split / `/settings`
- Public profile
- History rewrite
- Any new aggregation

## Acceptance Criteria

- [ ] Zero remaining `AdminOnly` / `AdminGuard` call sites whose only job is hiding Profil
- [ ] Non-admin can open `/profile` and see live (not fixture) blocks
- [ ] Account flows unchanged
- [ ] Demoable: a non-admin test user reaches the three acts
- [ ] Env-stripped vitest for the router/nav assertions + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 3, 24, success measure 24
- Tech Plan: ungate last
