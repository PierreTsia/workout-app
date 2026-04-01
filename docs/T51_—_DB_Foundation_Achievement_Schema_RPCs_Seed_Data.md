# T51 — DB Foundation: Achievement Schema, RPCs & Seed Data

## Goal

Stand up the entire backend data layer for the gamification system: 3 new tables with RLS, schema changes to `set_logs` and `user_profiles`, performance indexes, both RPCs (`check_and_grant_achievements` + `get_badge_status`), seed data for 5 groups × 5 ranks, and a retroactive badge grant script. After this ticket, the achievement engine is fully operational via SQL — no frontend required to verify.

## Dependencies

None — purely backend.

## Scope

### Migration 1: Achievement tables + RLS

File: `supabase/migrations/20260401000001_create_achievement_tables.sql`

Create 3 tables:

| Table | Key columns | RLS |
|---|---|---|
| `achievement_groups` | `id`, `slug` (unique), `name_fr`, `name_en`, `description_fr`, `description_en`, `metric_type`, `sort_order` | Public `SELECT` |
| `achievement_tiers` | `id`, `group_id` FK, `tier_level`, `rank`, `title_fr`, `title_en`, `threshold_value`, `icon_asset_url` (nullable), `UNIQUE(group_id, tier_level)` | Public `SELECT` |
| `user_achievements` | `id`, `user_id` FK → `auth.users`, `tier_id` FK, `granted_at`, `UNIQUE(user_id, tier_id)` | `SELECT` own rows only. All writes via `SECURITY DEFINER` RPC. |

Include 4 indexes in the same migration:

```sql
CREATE INDEX IF NOT EXISTS idx_sessions_user_finished ON sessions (user_id, finished_at) WHERE finished_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_set_logs_session_id ON set_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_was_pr ON set_logs (was_pr) WHERE was_pr = true;
CREATE INDEX IF NOT EXISTS idx_set_logs_rest_seconds ON set_logs (rest_seconds) WHERE rest_seconds IS NOT NULL;
```

### Migration 2: `rest_seconds` on `set_logs`

File: `supabase/migrations/20260401000002_add_rest_seconds_to_set_logs.sql`

```sql
ALTER TABLE set_logs ADD COLUMN rest_seconds integer;
```

Nullable. No backfill.

### Migration 3: `active_title_tier_id` on `user_profiles` + validation trigger

File: `supabase/migrations/20260401000003_add_active_title_to_user_profiles.sql`

- `ALTER TABLE user_profiles ADD COLUMN active_title_tier_id uuid REFERENCES achievement_tiers(id) ON DELETE SET NULL;`
- `BEFORE UPDATE OF active_title_tier_id` trigger (`validate_title_ownership`) — raises `check_violation` if user doesn't own the referenced tier.

Full SQL in Tech Plan → "Title Ownership Validation Trigger" section.

### Migration 4: `check_and_grant_achievements` RPC

File: `supabase/migrations/20260401000004_create_check_and_grant_achievements.sql`

- `SECURITY DEFINER`, `SET search_path = public`
- CTE-based: computes 5 metrics in one pass, grants eligible tiers, returns newly-unlocked
- `GRANT EXECUTE ON FUNCTION ... TO authenticated`

Full SQL in Tech Plan → "RPCs" section.

### Migration 5: `get_badge_status` RPC

File: `supabase/migrations/20260401000005_create_get_badge_status.sql`

- `STABLE`, `SECURITY DEFINER`, `SET search_path = public`
- Same CTE pattern, returns all 25 tiers with `is_unlocked`, `granted_at`, `current_value`, `progress_pct`
- `ORDER BY ag.sort_order, at.tier_level`
- `GRANT EXECUTE ON FUNCTION ... TO authenticated`

Full SQL in Tech Plan → "RPCs" section.

### Migration 6: Seed data

File: `supabase/migrations/20260401000006_seed_achievement_data.sql`

INSERT 5 groups + 25 tiers using the Full Title Reference table from the Discovery doc. `icon_asset_url` is `NULL` for now (populated in T54).

| Group slug | metric_type | sort_order |
|---|---|---|
| `consistency_streak` | `session_count` | 1 |
| `volume_king` | `total_volume_kg` | 2 |
| `rhythm_master` | `respected_rest_count` | 3 |
| `record_hunter` | `pr_count` | 4 |
| `exercise_variety` | `unique_exercises` | 5 |

### Retroactive grant script

File: `scripts/retroactive-badge-grant.sql`

```sql
SELECT check_and_grant_achievements(user_id) FROM user_profiles;
```

Run manually post-deploy (in T54). Not part of the migration chain.

### Enable Realtime

Toggle Realtime on `user_achievements` table in Supabase dashboard.

### Tests

RPC SQL tests run against local Supabase (`supabase db reset` + test seed):

- `check_and_grant_achievements`: user with 5 sessions → Bronze; 0 sessions → nothing; idempotent (second call = empty); multi-tier grant in one call; Rhythm Master 80% threshold; quick sessions excluded
- `get_badge_status`: returns all 25 tiers with correct `is_unlocked` / `progress_pct`; progress capped at 100
- `validate_title_ownership`: owned tier → OK; unowned tier → `check_violation`; unequip (null) → OK; unrelated update → no trigger fire

## Out of Scope

- Frontend types, hooks, or components (T52)
- `rest_seconds` instrumentation in `syncService` (T52)
- AI-generated icon assets (T54)
- `icon_asset_url` values in seed data (T54)

## Acceptance Criteria

- [ ] 3 new tables exist with correct columns, constraints, and RLS policies
- [ ] `set_logs.rest_seconds` nullable integer column exists
- [ ] `user_profiles.active_title_tier_id` FK exists with `ON DELETE SET NULL`
- [ ] `validate_title_ownership` trigger fires on `active_title_tier_id` change and rejects unowned tiers
- [ ] 4 indexes created (sessions composite, set_logs session_id, was_pr partial, rest_seconds partial)
- [ ] `check_and_grant_achievements` RPC computes all 5 metrics correctly and grants eligible tiers idempotently
- [ ] `get_badge_status` RPC returns all 25 tiers with progress percentages
- [ ] 5 groups + 25 tiers seeded with FR/EN titles and correct thresholds
- [ ] Realtime enabled on `user_achievements`
- [ ] `supabase db reset` runs cleanly with all migrations applied

## References

- [Discovery — Gamification Achievement Badge System #129](./Discovery_—_Gamification_Achievement_Badge_System_#129.md)
- [Tech Plan — Gamification Achievement Badge System #129](./Tech_Plan_—_Gamification_Achievement_Badge_System_#129.md) → Data Model, RPCs, PR 1
