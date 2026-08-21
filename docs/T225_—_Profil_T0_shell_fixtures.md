# T225 — Profil T0 shell + fixtures

## Goal

Ship `/profile` as a first-category, **admin-gated** fold: five-window toggle, thin `ProfileSection`, three acts on fixtures (Pierre data + empty/loading switch), FR/EN from the copy deck. Wiring later replaces the adapter, not the layout. Addresses Epic stories 1, 2, 4 (toggle UI), 5, 17, 19, 20.

## Mode

AFK — IA, act order, copy deck, and `AdminOnly`/`AdminGuard` reuse are locked.

## Slice

route + `AdminGuard` → drawer `AdminOnly` → `ProfilePage` + `ProfileWindowContext` → `ProfileSection` + fixture VMs → i18n `profile` ns → vitest (gate, fold order, empty vs loading)

## Dependencies

T224 (chart atoms exist to drop into Records / Mix / Équilibre sections).

## Scope

### Route and nav

| Item | Detail |
|---|---|
| Path | `/profile` (flat). No `/profile/dashboard`. |
| Gate | Copy `file:src/router/AdminGuard.tsx` + `file:src/components/admin/AdminOnly.tsx`. Non-admin `/profile` → `/`. No nav row. |
| Drawer | First-category row, same rank as History. Identity card stays `/account` (`file:src/components/SideDrawer.tsx`). |

### Shell

- `file:src/pages/ProfilePage.tsx`: window `kind` 7 / 30 / 100 / 365 / all; `includeDeltas === false` when `all`.
- `ProfileWindowContext` (React context, not Jotai).
- `file:src/components/profile/ProfileSection.tsx`: title + skeleton + error + empty + children. Copy `BalanceTab`, not `StatsDashboard` `"–"`.
- Five-value `ToggleGroup`; wraps on mobile. Labels: 7j / 30j / 100j / 1 an / Toujours.
- Act order: Cette fenêtre (Hero, Succès, pulse, Rythme, Mix) → Preuve (Records, Équilibre \| Tonnage 2-col desktop) → Pratique (Récurrents, Circuits).

### Fixtures

Every block renders from **the same VM types** T227+ will fill (`status: 'ok' | 'empty'`). Admin switch: Pierre-shaped data / all empty / all loading. Not a `<ProfileWidget<T>>` registry — adding a block is a `ProfileSection` + children.

Honor **Profil not-enough-data** in fixture sets (2 sessions → Équilibre empty; 0 declared RIR → no line; Cindy → Mix Circuits + Tonnage empty or 0 t).

### i18n

`file:src/locales/en/profile.json` + FR from `file:docs/visions/profile-copy-deck.canvas.tsx`. Product names untranslated: Quick Workout, RIR, PR, PB, AMRAP.

## Out of Scope

- Live RPCs / `useProfileSnapshot` (T227+)
- Human eyeball of the mocked fold (T237) — this ticket ships the switch; T237 is the HITL pass
- Removing the admin gate (T236)
- Skip-vs-plan rings
- Updating Vision / GitHub #512 body (T235)

## Acceptance Criteria

- [ ] Admin: Profil in drawer; `/profile` shows three acts in locked order with fixture data
- [ ] Non-admin: no nav row; `/profile` redirects home
- [ ] Toggle has five values; Toujours hides vs-préc. pills in the fixture VM (`includeDeltas: false`)
- [ ] Admin switch: empty ≠ loading; 2-session fixture leaves Équilibre empty
- [ ] Mix + Rythme sit above Records
- [ ] Tonnage is the second desktop column next to the radar (stacked on mobile)
- [ ] FR/EN keys exist; no raw i18n keys on the fold
- [ ] Demoable: toggle 7j → 30j restyles fixture grain (day vs week labels) without a network call
- [ ] `npx tsc -p tsconfig.app.json --noEmit` and gated-route tests pass with env-stripped vitest

## References

- Epic Brief stories 1–2, 4–5, 17, 19–20
- Tech Plan: ProfilePage, ProfileSection, window context, prefetch (fixture-only here)
- `file:docs/Vision_—_Profil_dashboard.md`
