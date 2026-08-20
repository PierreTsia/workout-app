# T213 — Grant RPC `threshold_value` + mapper

## Goal

The overlay’s threshold line needs the hero’s requirement. Today `check_and_grant_achievements` returns `tier_id, group_slug, rank, title_en, title_fr, icon_asset_url` — no `threshold_value`. This ticket adds the column end-to-end (RPC → `UnlockedAchievement` → Realtime mapper) so later overlay work can interpolate `thresholdHint.{group_slug}`. Stories: 12.

## Mode

AFK

## Slice

migration (`RETURNS TABLE`) → `UnlockedAchievement` → Realtime mapper → `syncService` RPC typing → tests

## Dependencies

None

## Scope

### Migration

New file under `file:supabase/migrations/` replacing **only** `check_and_grant_achievements`.

Copy the effective body from `file:supabase/migrations/20260819114837_quick_sessions_exclude_detached_days.sql`.

Changes, and only these:

1. `RETURNS TABLE` adds `threshold_value numeric` after `icon_asset_url`.
2. `eligible` SELECT adds `at.threshold_value`.
3. Final `SELECT e.id, e.slug, e.r, e.title_en, e.title_fr, e.icon_asset_url` adds `e.threshold_value`.

Keep `SECURITY DEFINER`, `SET search_path = public`, `#variable_conflict use_column`, and the `auth.uid() = p_user_id OR is_trusted_backend_caller()` guard. Do **not** redefine `get_badge_status`. Do **not** touch `qualifying_runs` / metrics CTEs (arch test identity).

### Types

`file:src/types/achievements.ts` — `UnlockedAchievement` gains `threshold_value: number`.

### Realtime mapper

`file:src/components/achievements/AchievementRealtimeProvider.tsx` — include `threshold_value: match.threshold_value` (already on `BadgeStatusRow`).

### RPC client

`file:src/lib/syncService.ts` — `processSessionFinish` already casts RPC `data` to `UnlockedAchievement[]`. Prefer `.returns<UnlockedAchievement[]>()` (or equivalent typed rpc) over `as`. No overlay UI in this ticket.

### Tests

- Extend `file:src/lib/syncService.test.ts` grant-RPC case if it asserts return shape; otherwise add a focused test that a row with `threshold_value` is pushed onto the queue unchanged.
- `file:src/test/circuitAchievementTracks.arch.test.ts` must still pass (`qualifying_runs` identical across the two RPCs).
- `file:src/test/securityDefiner.arch.test.ts` must still pass (guard + `search_path` present on the new definition).

## Out of Scope

- Overlay chrome / threshold line rendering (T214)
- Equip (T215)
- Playground (T217)

## Acceptance Criteria

- [ ] Latest `check_and_grant_achievements` `RETURNS TABLE` includes `threshold_value numeric`
- [ ] `eligible` and the output `SELECT` project `at.threshold_value` / `e.threshold_value`
- [ ] `UnlockedAchievement` requires `threshold_value: number`
- [ ] Realtime mapper copies `match.threshold_value`
- [ ] `npx tsc -p tsconfig.app.json --noEmit` green
- [ ] `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run src/lib/syncService.test.ts src/test/circuitAchievementTracks.arch.test.ts src/test/securityDefiner.arch.test.ts` green
- [ ] Demoable: a grant RPC row (fixture or typed mapper) carries `threshold_value` into `pushAchievementsToQueue`

## References

- Epic Brief: `file:docs/done/Epic_Brief_—_Grant_Overlay_—_One_Ceremony_per_Batch_#491.md`
- Tech Plan: Data Model + Critical Constraints (RPC copy rule)
- Current grant function: `file:supabase/migrations/20260819114837_quick_sessions_exclude_detached_days.sql`
