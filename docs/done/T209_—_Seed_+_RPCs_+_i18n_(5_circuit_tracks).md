# T209 — Seed + RPCs + i18n (5 circuit tracks)

## Goal

Ship the five circuit achievement groups end-to-end: seed rows, `qualifying_runs` + five metric branches in **both** achievement RPCs, and FR/EN i18n placeholders so `/achievements` shows the new accordion rows with correct progress after migrate. Addresses Epic stories 1–10, 12–17 (product surface). Stories: 1–10, 12–17.

## Mode

AFK — titles, thresholds, casts, and SQL shape are locked in the Epic Brief / Tech Plan.

## Slice

`migration (seed + both RPCs)` → `achievements.json` → Succès accordion (data-driven) → vitest/type-check

## Dependencies

T208 (score contract fixtures as oracle for `fullRounds`).

## Scope

### Migration (one file, #218 shape)

| Step | Detail |
|---|---|
| Seed groups | `circuit_runner`, `spidey`, `olympians`, `heroes`, `pantheoniste` — `sort_order` 12–16, names from Epic Brief |
| Seed tiers | 5 ranks × 5 groups; titles + thresholds exactly as Epic Brief locked table |
| Replace RPCs | `check_and_grant_achievements` + `get_badge_status`: shared `qualifying_runs` CTE + cast slug lists + 5 `UNION ALL` branches; keep existing 11 metrics |
| Qualifying run | GO `block_runs.benchmark_circuit_id` → `benchmark_circuits.owner_id IS NULL`; `finished_at NOT NULL`; `full_rounds = MAX(set_number)-1 ≥ 1` via `block_exercises`/`set_logs` |
| Cast Clearing | LEFT JOIN fixed slug lists → `COALESCE(cnt,0)` → `MIN` (missing seed = 0) |
| Spidey | `MAX(full_rounds)` where `slug = 'cindy'` |
| Icons | `icon_asset_url` NULL |

Casts: olympians `zeus,ares,athena,hades` · heroes `heracles,theseus,atlas,achilles` · pantheoniste = eight · runner = all seeds · spidey = cindy.

### i18n

| File | Keys |
|---|---|
| `file:src/locales/fr/achievements.json` | `groups.*`, `groupDescriptions.*`, `thresholdHint.*` for all 5 slugs |
| `file:src/locales/en/achievements.json` | idem |

Use Tech Plan metric placeholders (voice rewrite later OK).

### Metrics (must match in both RPC bodies)

| `metric_type` | Value |
|---|---|
| `circuit_runner` | `COUNT(*)` from `qualifying_runs` |
| `spidey` | `COALESCE(MAX(full_rounds) FILTER cindy, 0)` |
| `olympians` / `heroes` / `pantheoniste` | `MIN` over LEFT JOIN fixed slugs |

### Demoable behavior

After `supabase db reset` / migrate: open Succès → five new rows (sort 12–16). Finish a session with a qualifying Cindy → runner + Spidey progress move via existing `processSessionFinish` (no syncService code change).

## Out of Scope

- Arch test hardening beyond what’s needed to land the migration (→ T210)
- Running `retroactive-badge-grant.sql` as ops (→ T211 / T212)
- Catalog badge chrome, bottleneck UI, badge art, equip/showcase changes
- Rewriting `groupDescriptions` for “voice” (placeholders ship)

## Acceptance Criteria

- [ ] Migration seeds 5 groups × 5 tiers with locked titles/thresholds/sort_order
- [ ] Both RPCs contain identical `qualifying_runs` + five new metric branches + existing 11
- [ ] Cast Clearing uses LEFT JOIN fixed slugs (Hades missing → olympians value 0) — documented in SQL comments if not unit-testable in CI
- [ ] FR + EN `groupDescriptions` and `thresholdHint` exist for all 5 slugs (no raw keys in accordion/drawer)
- [ ] No new React components; catalog pages untouched
- [ ] `npx tsc -p tsconfig.app.json --noEmit` green
- [ ] Demo: post-migrate, `/achievements` lists the five groups; a qualifying history advances runner (and Spidey if Cindy)

## References

- Epic Brief: `file:docs/Epic_Brief_—_Benchmark_Circuit_achievement_tracks_#482.md`
- Tech Plan: `file:docs/Tech_Plan_—_Benchmark_Circuit_achievement_tracks_#482.md` (CTE sketch, i18n table)
- Precedent: `file:supabase/migrations/20260419120000_new_achievement_tracks.sql`
- Current RPCs: `file:supabase/migrations/20260802170000_secure_definer_rpcs.sql`
- ADR: `file:docs/adr/0019-circuit-achievement-cast-clearing-and-spidey.md`
