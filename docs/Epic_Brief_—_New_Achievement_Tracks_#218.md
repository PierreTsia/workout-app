# Epic Brief — New Achievement Tracks (#218)

## Summary

Expand the achievement system from 5 groups to 11 by adding 6 new tracks that reward overlooked play styles: ad-hoc workouts, leg training, weekly consistency streaks, heavy-volume sessions, PR hot streaks, and early-morning discipline. Each track follows the existing 5-rank Bronze→Diamond ladder and plugs into the current `check_and_grant_achievements` / `get_badge_status` RPCs with no structural changes to the frontend — the accordion UI from #174 already scales to 10+ groups dynamically.

---

## Context & Problem

**Who is affected:** All users with the achievement system active (post-#129 deployment).

**Current state:**
- 5 achievement groups exist: Consistency Streak, Volume King, Rhythm Master, Record Hunter, Exercise Variety
- The UI (#174) renders groups dynamically from `get_badge_status` — supports N groups with no code change
- The RPC architecture uses a `metrics` CTE with `UNION ALL` branches per `metric_type` — extensible by adding branches
- The issue (#174) explicitly deferred "new achievement tracks" to a follow-up

**Pain points:**

| Pain | Impact |
|---|---|
| Only 5 groups — users who primarily do quick workouts, train legs, or work out early have no recognition | Low engagement ceiling; achievements feel narrow |
| No streak-based metric — `active_weeks` counts total qualifying weeks, not *consecutive* ones | Misses the "don't break the chain" psychology that drives retention |
| No muscle-group-specific track — variety is rewarded, but leg training isn't | Users who don't skip leg day get no acknowledgment |
| Ad-hoc ("quick") sessions are invisible to the achievement system | Power users who skip program days and just lift get zero badge progress beyond volume/PRs |

---

## Goals

| Goal | Measure |
|---|---|
| Broaden the achievement surface to reward 6 distinct play styles | 11 total groups live, each with 5 tiers (55 total tiers) |
| Introduce streak-based and time-based metrics alongside existing aggregates | Streak King and PR Streak use window-function gap detection; Early Bird uses timezone-aware local hour |
| Zero frontend component changes — purely backend + data + i18n | No new React components; only migration SQL, seed data, and i18n strings |
| Retroactive grant for existing users on deploy | All 6 new tracks evaluated for historical data via the same idempotent RPC |

---

## Scope

**In scope:**

1. **Quick & Dirty** (`quick_sessions`) — count of finished sessions where `workout_day_id IS NULL`
2. **Leg Day Survivor** (`leg_day`) — count of sets targeting leg muscle groups (`Quadriceps`, `Ischios`, `Fessiers`, `Adducteurs`, `Mollets`)
3. **Streak King** (`streak_king`) — longest streak of consecutive calendar weeks with at least 1 finished session
4. **Le Marathonien** (`marathoner`) — count of sessions where total volume (weight × reps) exceeds a qualifying threshold
5. **La Série Ininterrompue** (`pr_streak`) — longest streak of consecutive sessions where at least 1 set was a PR
6. **Early Bird** (`early_bird`) — count of sessions finished before 8:00 AM local time

For each track:
- 1 new row in `achievement_groups` + 5 rows in `achievement_tiers`
- 1 new `UNION ALL` branch in both RPCs' `metrics` CTE
- Threshold values following the exponential curve from the rebalance migration
- i18n strings for group names, descriptions, threshold hints (EN + FR)
- Badge icon assets (5 ranks × 6 tracks = 30 new icons)

Supporting infrastructure:
- `timezone text` column on `user_profiles` (for Early Bird local-time computation)
- Backfill existing users with `'Europe/Paris'` (all current users are FR)
- Silent timezone capture during onboarding via `Intl.DateTimeFormat().resolvedOptions().timeZone`

**Out of scope:**

- New frontend components or UI changes (accordion already handles N groups)
- Le Spécialiste / per-muscle-group tracks (e.g. Chest Specialist, Back Specialist — better as distinct groups, deferred)
- Bodyweight Beast, Marathon Sets, Program Loyalist (stretch tracks from issue — deferred)
- Admin UI for achievement management
- Social sharing / leaderboards
- `user_lifetime_stats` materialized table (optimization — not needed at current scale)

---

## Track Feasibility Analysis

### Track 1: Quick & Dirty (`quick_sessions`)

**Metric:** `COUNT(*) FROM user_sessions WHERE workout_day_id IS NULL`

**Feasibility:** Trivial. `sessions.workout_day_id` is nullable — `NULL` means the user started an ad-hoc / quick workout without selecting a program day. Already indexed via `idx_sessions_user_finished`.

**Edge cases:**
- Sessions started from a program day but where user deleted the program mid-session: `workout_day_id` may still be set → correctly excluded
- Offline quick sessions: synced with `workout_day_id = NULL` → correctly counted

| Rank | Title (FR) | Title (EN) | Threshold |
|---|---|---|---|
| Bronze | "Pas d'excuse" | "No Excuses" | 5 sessions |
| Silver | "Franc-tireur" | "Lone Wolf" | 20 sessions |
| Gold | "Électron libre" | "Free Radical" | 60 sessions |
| Platinum | "Hors Programme" | "Off Script" | 150 sessions |
| Diamond | "L'Incontrôlable" | "The Uncontrollable" | 400 sessions |

---

### Track 2: Leg Day Survivor (`leg_day`)

**Metric:** `COUNT(*) FROM set_logs sl JOIN exercises e ON e.id = sl.exercise_id JOIN user_sessions us ON us.id = sl.session_id WHERE e.muscle_group IN ('Quadriceps', 'Ischios', 'Fessiers', 'Adducteurs', 'Mollets')`

**Feasibility:** Straightforward. Requires a JOIN to `exercises` (not done by any existing CTE). The `muscle_group` column uses French taxonomy values. All 5 lower-body groups are included — quads, hamstrings, glutes, adductors, and calves are all leg work.

**How it works in plain terms:** Every time you log a set where the exercise's primary muscle group is one of the 5 leg values, that's +1. Do 4 sets of squats + 3 sets of calf raises in one session? That's 7 leg sets. The metric accumulates over your lifetime — it doesn't care whether the sets were in the same session or spread across months.

**Edge cases:**
- Secondary muscles are NOT counted (`secondary_muscles` array) — only `muscle_group` (primary). Keeps the metric clean and predictable.
- Duration exercises (e.g. wall sits) with `reps_logged IS NULL`: still counted — we're counting *sets performed*, not reps.

| Rank | Title (FR) | Title (EN) | Threshold |
|---|---|---|---|
| Bronze | "Rescapé du squat" | "Squat Survivor" | 50 sets |
| Silver | "Anti-chicken legs" | "Anti-Chicken Legs" | 200 sets |
| Gold | "Roi du Rack" | "Rack Royalty" | 500 sets |
| Platinum | "Pilier de fonte" | "Iron Pillar" | 1,200 sets |
| Diamond | "Titan des cuisses" | "Thigh Titan" | 3,000 sets |

---

### Track 3: Streak King (`streak_king`)

**Metric:** Longest streak of consecutive calendar weeks where the user finished at least 1 session.

**Feasibility:** Requires window-function gap detection — a step up from existing simple aggregates. The CTE:
1. Extract distinct calendar weeks (`date_trunc('week', finished_at)`) from `user_sessions`
2. Assign a sequential week number (epoch-based or `ROW_NUMBER`)
3. Use the classic `week_number - ROW_NUMBER()` gap detection trick to group consecutive weeks
4. `MAX(COUNT(*))` across groups = longest streak

Output is still a single numeric value, so the `eligible`/`granted` CTE pattern is unchanged.

**Edge cases:**
- ISO weeks (`date_trunc('week', ...)` uses Monday as week start in Postgres) — consistent across users
- A week with only unfinished sessions (`finished_at IS NULL`) doesn't count → correctly excluded by `user_sessions` CTE
- Gap of exactly 1 week breaks the streak — intentional (this is "consecutive weeks", not "X out of Y")
- Unlike `active_weeks` (which requires 3+ sessions/week), this only requires 1 session/week — different behavior, distinct value proposition

| Rank | Title (FR) | Title (EN) | Threshold |
|---|---|---|---|
| Bronze | "Trois de suite" | "Three in a Row" | 3 weeks |
| Silver | "Deux mois d'acier" | "Steel Streak" | 8 weeks |
| Gold | "Trimestre de fer" | "Iron Quarter" | 12 weeks |
| Platinum | "Inarrêtable" | "Unstoppable" | 26 weeks |
| Diamond | "La Chaîne Éternelle" | "The Eternal Chain" | 52 weeks |

---

### Track 4: Le Marathonien (`marathoner`)

**Metric:** Count of sessions where `SUM(weight_logged * reps_logged::int) >= 5000` (kg) within that single session.

**Feasibility:** Moderate. Requires per-session volume aggregation, then counting qualifying sessions. A subquery groups `set_logs` by `session_id`, computes session volume, filters by threshold, then counts.

**Design decision:** The 5,000 kg qualifying floor is hardcoded in the CTE. This is a "what counts as a heavy session" constant, not a tier threshold. The tiers then reward *how many* heavy sessions you've done. If the floor needs tuning, it's a single value in the migration.

**Edge cases:**
- Duration-based sets (`reps_logged IS NULL`) excluded from volume computation — same as existing `total_volume_kg` metric
- Non-numeric `reps_logged` values excluded via `reps_logged ~ '^\d+$'` guard — consistent with existing RPCs
- Sessions with only bodyweight exercises may never reach 5,000 kg — acceptable, this track rewards heavy volume

| Rank | Title (FR) | Title (EN) | Threshold |
|---|---|---|---|
| Bronze | "Séance lourde" | "Heavy Hitter" | 5 sessions |
| Silver | "Tonnage garanti" | "Tonnage Guaranteed" | 20 sessions |
| Gold | "Broyeur de barres" | "Bar Crusher" | 60 sessions |
| Platinum | "Usine à volume" | "Volume Factory" | 150 sessions |
| Diamond | "Le Marathonien" | "The Marathoner" | 400 sessions |

---

### Track 5: La Série Ininterrompue (`pr_streak`)

**Metric:** Longest streak of consecutive sessions (ordered by `finished_at`) where at least 1 set had `was_pr = true`.

**Feasibility:** Complex — same gap-detection pattern as Streak King, but over sessions instead of weeks. The CTE:
1. Identify sessions with at least 1 PR (`EXISTS (SELECT 1 FROM set_logs WHERE session_id = us.id AND was_pr = true)`)
2. Assign ordinal rank to ALL sessions, then identify PR sessions within that sequence
3. Gap detection via `session_rank - ROW_NUMBER()` on PR sessions only
4. `MAX(group_size)` = longest PR streak

**Edge cases:**
- A session with 0 PRs breaks the streak — intentional
- Quick sessions and program sessions both count — if they have a PR, they're in
- Two sessions on the same day: ordered by `finished_at` — both count separately
- Historical PR backfill (`was_pr` already backfilled via `scripts/backfill-was-pr.ts`) means retroactive evaluation is accurate

| Rank | Title (FR) | Title (EN) | Threshold |
|---|---|---|---|
| Bronze | "Trois d'affilée" | "Flash Fire" | 3 sessions |
| Silver | "En feu" | "On Fire" | 5 sessions |
| Gold | "Enchaînement parfait" | "Perfect Run" | 10 sessions |
| Platinum | "Fléau des plateaux" | "Plateau Slayer" | 20 sessions |
| Diamond | "Le Phénomène" | "The Phenomenon" | 40 sessions |

---

### Track 6: Early Bird (`early_bird`)

**Metric:** `COUNT(*) FROM user_sessions us JOIN user_profiles up ON up.user_id = ... WHERE EXTRACT(HOUR FROM us.finished_at AT TIME ZONE up.timezone) < 8`

**Feasibility:** Moderate. `finished_at` is `timestamptz`. Converting to the user's local time requires a `timezone` column on `user_profiles`. The `AT TIME ZONE` conversion in Postgres is well-supported for IANA timezone names (e.g. `'Europe/Paris'`).

**Timezone strategy (settled):**
- **New column:** `ALTER TABLE user_profiles ADD COLUMN timezone text DEFAULT 'Europe/Paris'`
- **Backfill:** `UPDATE user_profiles SET timezone = 'Europe/Paris'` — all current users are FR
- **New users:** Captured silently during onboarding via `Intl.DateTimeFormat().resolvedOptions().timeZone` in `file:src/hooks/useCreateUserProfile.ts` — no form field, no question asked
- **Fallback:** If `timezone` is somehow NULL, the CTE falls back to `'UTC'`

**Edge cases:**
- Sessions finished at exactly 8:00:00 AM → NOT counted (`< 8`, not `<= 8`)
- Overnight sessions (started 11 PM, finished 1 AM) → `finished_at` is 1 AM → counts as early bird
- DST transitions: Postgres handles this correctly with IANA timezone names
- User who travels: timezone reflects registration timezone, not current location — acceptable for MVP. A future enhancement could update timezone on login.

| Rank | Title (FR) | Title (EN) | Threshold |
|---|---|---|---|
| Bronze | "Lève-tôt" | "Early Riser" | 5 sessions |
| Silver | "Coq du matin" | "Morning Rooster" | 20 sessions |
| Gold | "Guerrier de l'aube" | "Dawn Warrior" | 60 sessions |
| Platinum | "Premier au rack" | "First at the Rack" | 150 sessions |
| Diamond | "Le Soleil se lève pour toi" | "The Sun Rises for You" | 400 sessions |

---

## Success Criteria

- **Numeric:** 11 achievement groups live (5 existing + 6 new), 55 total tiers, all evaluable by the existing idempotent RPC
- **Numeric:** Both RPCs (`check_and_grant_achievements`, `get_badge_status`) execute in < 200ms for a user with 500 sessions and 10k set_logs (verified via `EXPLAIN ANALYZE`)
- **Qualitative:** Existing users see retroactively granted badges for the 6 new tracks on first app open after deploy (no overlay flood — silent insert)
- **Qualitative:** The accordion UI displays all 11 groups with no layout or performance degradation
- **Qualitative:** New users get their timezone captured silently at onboarding — no extra form step
- **Qualitative:** Adding a 12th track in the future requires only a SQL migration (INSERT groups + tiers + CTE branch) and i18n strings — no React component changes

---

## References

- Parent issue: #218
- Predecessor issues: #129 (gamification system), #174 (UI redesign)
- UI redesign PR: #217
- Discovery doc: `file:docs/done/Discovery_—_Gamification_Achievement_Badge_System_#129.md`
- Tech Plan (backend): `file:docs/done/Tech_Plan_—_Gamification_Achievement_Badge_System_#129.md`
- Tech Plan (UI): `file:docs/Tech_Plan_—_Achievements_UI_Redesign_#174.md`
- Current RPCs (source of truth): `file:supabase/migrations/20260403000001_rebalance_thresholds_and_replace_rhythm.sql`
- Muscle taxonomy: `file:src/lib/trainingBalance.ts` (13 French values)
- Onboarding profile creation: `file:src/hooks/useCreateUserProfile.ts`
