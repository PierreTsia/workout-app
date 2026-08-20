# T220 — Seed + RPCs + i18n + arch (5 bodyweight tracks)

## Goal

Ship the five Bodyweight Trinity groups end-to-end: seed rows, family UUID CTEs + five metric branches in **both** achievement RPCs, FR/EN i18n, and an arch test that pins the lists and live-chain SQL. After this ticket, `/achievements` shows the new accordion rows; a finished session can grant from full history. Addresses Epic stories 1–16, 18–21.

## Mode

AFK — titles, thresholds, UUID lists, and SQL shape are locked in the Epic Brief / Tech Plan.

## Slice

`migration (seed + both RPCs)` → `achievements.json` → Succès accordion (data-driven) → `bodyweightAchievementTracks.arch.test.ts` → vitest / `tsc -p tsconfig.app.json`

## Dependencies

None.

## Scope

### Migration (one file, #482 shape)

Filename must contain `bodyweight_trinity_achievement_tracks` (arch test glob).

| Step | Detail |
|---|---|
| Seed groups | `push_ups`, `pull_ups`, `bw_squats`, `bw_expert`, `hundred_a_day` — `sort_order` 17–21, names/descriptions from Tech Plan seed SQL |
| Seed tiers | 5 ranks × 5 groups; titles + thresholds exactly as Epic Brief locked table. SQL apostrophes: `Cul vers l''herbe`, `Jours d''affilée…` |
| Replace RPCs | Copy live bodies then append. Grant: `file:supabase/migrations/20260819174900_grant_achievements_threshold_value.sql`. Status: `file:supabase/migrations/20260819114837_quick_sessions_exclude_detached_days.sql`. **No DROP** of `check_and_grant_achievements`. Preserve `qualifying_runs`, 16 existing metric branches, auth guards, `threshold_value` on grant RETURNS TABLE |
| Family CTEs | `push_up_ids` (8), `pull_up_ids` (6), `bw_squat_ids` (6) — Tech Plan frozen UUIDs |
| Metrics | `family_rep_totals` SUM numeric `reps_logged` (`~ '^\d+$'`), no block filter; `bw_expert` = `LEAST` of three `COALESCE`d sums; `hundred_a_day` = live chain (`hundred_a_day_current`), **not** `MAX(streak_len)` |
| Day bucket | `(set_logs.logged_at AT TIME ZONE tz)::date`; `tz` from `user_profiles.timezone` COALESCE `'UTC'` |
| Yesterday grace | island `end_day BETWEEN today-1 AND today` in user tz; `now()` not `clock_timestamp()` |
| Icons | `icon_asset_url` NULL |
| Grants | Re-GRANT EXECUTE on both functions |

UUIDs, CTE sketch, and seed INSERT: Tech Plan sections **Frozen family UUIDs** and **Shared CTE sketch**.

### i18n

| File | Keys |
|---|---|
| `file:src/locales/fr/achievements.json` | `groups.*`, `groupDescriptions.*`, `thresholdHint.*` for all 5 slugs — Tech Plan **i18n (locked)** table |
| `file:src/locales/en/achievements.json` | idem |

Accordion headers still come from DB `name_fr` / `name_en`; overlay chips from `groups.${slug}`. All three must match.

### Arch test

New `file:src/test/bodyweightAchievementTracks.arch.test.ts` copying helpers from `file:src/test/circuitAchievementTracks.arch.test.ts`:

| Assert | Why |
|---|---|
| 20 IN UUID strings present in **that** migration | Family lock |
| 9 named OUT UUIDs absent from the three ARRAYs | Knee / barre / jump squat / … cannot sneak in |
| Both function bodies in that file: `family_rep_totals` / `push_up_ids` normalize equal | Grant/status drift |
| Last-wins latest grant **and** latest status still contain `'push_ups'`…`'hundred_a_day'` + the 20 UUIDs | Later patch dropping branches |
| `hundred_a_day_current` has today/yesterday grace and does **not** contain `MAX(streak_len)` | Live chain |
| i18n EN+FR keys for 5 slugs (`groups`, `groupDescriptions`, `thresholdHint`) | Missing-key overlay |

Run vitest with `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY=` (workspace rule).

## Out of Scope

- Playground fixtures (T222)
- Retroactive script runbook (T221)
- Badge PNG generation / Storage upload (T223)
- `syncService.ts` changes
- New HITL route
- `movement_family` column

## Acceptance Criteria

- [ ] Migration seeds 5 groups × 5 tiers at `sort_order` 17–21; `icon_asset_url` NULL
- [ ] Both RPCs expose `push_ups`, `pull_ups`, `bw_squats`, `bw_expert`, `hundred_a_day` with identical family CTEs
- [ ] After migrate, `/achievements` shows five new locked rows (0 progress) with locked FR/EN titles — no raw i18n keys
- [ ] Arch test green: 20 IN / 9 OUT, CTE parity, last-wins, no `MAX(streak_len)` on `hundred_a_day`, i18n keys
- [ ] `npx tsc -p tsconfig.app.json --noEmit` and `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run src/test/bodyweightAchievementTracks.arch.test.ts` pass
- [ ] Demoable: one finished session (or SQL RPC call) on a user with Cindy/family history grants the matching lifetime tiers

## References

- Epic Brief: `file:docs/Epic_Brief_—_Bodyweight_Trinity_achievement_tracks_#509.md` (stories 1–16, 18–21)
- Tech Plan: `file:docs/Tech_Plan_—_Bodyweight_Trinity_achievement_tracks_#509.md`
- Precedent: `file:docs/done/T209_—_Seed_+_RPCs_+_i18n_(5_circuit_tracks).md`
- Arch template: `file:src/test/circuitAchievementTracks.arch.test.ts`
- Live grant: `file:supabase/migrations/20260819174900_grant_achievements_threshold_value.sql`
- Live status: `file:supabase/migrations/20260819114837_quick_sessions_exclude_detached_days.sql`
