# T222 — HITL playground + Succès closeout

## Goal

Extend `/_unlock-overlay` fixtures so a reviewer can fire Bodyweight Trinity **Grant Batch**es without farming a 100-day streak, then eyeball accordion copy and live `current_value` on existing `/achievements`. No new HITL route. Addresses Epic stories 17, 22, 23.

## Mode

HITL — implement the fixtures AFK from the Tech Plan table; closeout requires a human on `/_unlock-overlay` and `/achievements`.

## Slice

`UnlockOverlayPlaygroundPage` fixtures + tests → local migrate + retro script → `/_unlock-overlay` + `/achievements` checklist

## Dependencies

T220, T221 (guards + runbook in place; i18n + RPC live).

## Scope

### Playground fixtures (code)

Keep the existing 9 ceremony-shape buttons. Add a second row via `FIXTURE_BUTTONS` / `grant()` in `file:src/pages/UnlockOverlayPlaygroundPage.tsx`. Update `BUTTON_NAMES` in `file:src/pages/UnlockOverlayPlaygroundPage.test.tsx`.

| Button | Grant Batch |
|---|---|
| `Pompes ladder` | `push_ups` bronze→diamond (5 grants, overflow) |
| `Tractions diamond` | `pull_ups` diamond 25 000 — *Le Roi de la barre* |
| `Squat diamond` | `bw_squats` diamond 25 000 — *Le Puits éternel* |
| `Expert diamond` | `bw_expert` diamond 25 000 — *Expert du poids du corps* |
| `Hard Time diamond` | `hundred_a_day` diamond 100 — *100 jours ferme* / *Hard Time* |
| `BW mixed` | `push_ups` gold + `pull_ups` silver + `bw_squats` bronze + `bw_expert` platinum + `hundred_a_day` gold |

Use Epic-locked titles/thresholds. `icon_asset_url: null` until T223. `crypto.randomUUID()` for `tier_id` so re-clicks work. **Do not** add `/_achievements` or any second underscore route.

### Setup (HITL)

1. Branch with T220–T221 merged (or stacked).
2. Apply migration; run `scripts/retroactive-badge-grant.sql` for the test user.
3. PWA: `/_unlock-overlay` then `/achievements`.

### Checklist (eyeball)

| Check | Pass |
|---|---|
| `/_unlock-overlay` still has the original 9 buttons; new row fires the six batches above | |
| Pompes ladder overflow ceremony; mixed batch hero + supporting medals | |
| Overlay chips use `groups.*` (Pompes, Tractions, … 100 jours ferme) — no raw keys | |
| `/achievements` shows 5 new groups, sort after Pantheoniste, locked titles FR/EN | |
| Empty history: five rows visible, bronze locked, 0 progress | |
| Family SUM: diamond/pike/chin-up count; knee / barre / jump-squat duration do not | |
| Cindy 20 on-ramp: Tractions 100, Pompes 200, Squats 300, expert 100 | |
| Master `current_value` = MIN of the three (pull-ups bottleneck) | |
| `hundred_a_day`: 50+50 same local day qualifies; miss → bar 0, gold row remains | |
| 23:30 Europe/Paris `logged_at` buckets that local date | |
| Catalog / Library unchanged (no new achievement chrome) | |
| Finish still succeeds if grant RPC fails (spot-check / existing test) | |

### Outcome

- Comment on #509 / #510 or the PR with pass/fail notes.
- File follow-ups only for real bugs (not copy polish unless broken).

## Out of Scope

- Badge art (T223) — ceremony with NULL icon is a pass
- Changing thresholds, titles, or family lists
- Home widget / notifications
- Historical-max diamond backfill

## Acceptance Criteria

- [ ] Six new playground buttons exist; original nine still work
- [ ] Playground tests cover the new `BUTTON_NAMES`
- [ ] Checklist completed on local (or staging) with notes
- [ ] At least one mixed **Grant Batch** and one overflow ladder signed off on `/_unlock-overlay`
- [ ] Accordion empty-state + at least one real `current_value` signed off on `/achievements`
- [ ] Zero new HITL routes
- [ ] #509 / PR updated: HITL done or blockers listed

## References

- Epic Brief HITL recette: `file:docs/Epic_Brief_—_Bodyweight_Trinity_achievement_tracks_#509.md`
- Tech Plan playground table: `file:docs/Tech_Plan_—_Bodyweight_Trinity_achievement_tracks_#509.md`
- Playground: `file:src/pages/UnlockOverlayPlaygroundPage.tsx` → `/_unlock-overlay`
- Accordion: `file:src/pages/AchievementsPage.tsx` → `/achievements`
- Precedent: `file:docs/done/T212_—_HITL_Succès_closeout.md`
- Epic stories 17, 22, 23
