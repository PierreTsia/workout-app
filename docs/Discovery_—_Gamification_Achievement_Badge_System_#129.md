# Discovery — Gamification: Achievement & Badge System (#129)

## Refined Goal

Implement a persistent, backend-driven, **tiered achievement system** that rewards consistency, volume, records, rest discipline, and variety through symbolic badges. Achievements are checked via a dedicated RPC (`check_and_grant_achievements`) called after each session finish — **decoupled from the session save transaction** so a badge failure never risks losing workout data. Real-time unlock feedback via Supabase Realtime. Badge visuals are AI-generated per rank.

Philosophy: "Blizzard-style" — reward *progression*, not collection. Each achievement group uses a **5-rank ladder: Bronze → Silver → Gold → Platinum → Diamond**, mirroring classic competitive gaming tiers. Players advance through ranks within each group, creating a long-term journey feel.

---

## Context & Prior Art

### What exists today

| Asset | Location | Relevance |
|---|---|---|
| **`sessions.finished_at`** | `file:src/types/database.ts` | Clean "workout completed" event — natural trigger point for achievement checks |
| **`set_logs.was_pr`** (boolean) | `file:src/types/database.ts` | PR detection already computed at log time — `COUNT(was_pr = true)` gives lifetime PRs |
| **`set_logs.weight_logged` × `reps_logged`** | `file:src/types/database.ts` | Volume (tonnage) computable per set; `reps_logged` is text but castable for integer reps |
| **`set_logs.exercise_id`** → `exercises` | Join path | `COUNT(DISTINCT exercise_id)` gives unique exercise variety |
| **`get_cycle_stats` RPC** | `supabase/migrations/20260320130000_create_get_cycle_stats.sql` | Precedent for aggregation RPCs with delta computation |
| **Sonner toasts** | `file:src/components/ui/sonner.tsx`, used globally | Available for minor feedback toasts (e.g. "Title equipped"). **Not** used for the achievement unlock overlay — that's a Radix Dialog. |
| **React Query + Jotai** | `file:src/lib/queryClient.ts`, `file:src/store/atoms.ts` | Established data-fetching and client state patterns |
| **i18n (FR + EN)** | `file:src/lib/i18n.ts`, `file:src/locales/` | Namespace-per-feature, dual-language |
| **Account page** | `file:src/pages/AccountPage.tsx` at `/account` | Natural home for a `BadgeGrid` component |
| **No Supabase Realtime usage** | Confirmed via codebase search | Realtime is new plumbing — but easy to enable (table config toggle + one `.channel()` subscription) |

### What does NOT exist

- **No achievement/badge/gamification tables or logic** — this is greenfield.
- **No `rest_seconds` on `set_logs`** — the rest timer (`file:src/hooks/useRestTimer.ts`) is purely ephemeral (Jotai atom in localStorage). No rest duration is persisted to the DB today. However, the fix is simple: add an optional `rest_seconds integer` column to `set_logs` and have the front send the elapsed rest when logging a set. Fire-and-forget — no complex timer architecture change needed.
- **No running totals / materialized counters** — all-time aggregates (total sessions, total volume, total PRs) must be computed from raw data today.

---

## Achievement Groups — Feasibility Analysis

### Group 1: "The Consistency Streak" (workout count)

| Rank | Title (FR) | Title (EN) | Milestone | Feasibility |
|---|---|---|---|---|
| Bronze | "Apprenti Courbaturé" | "The Sore Apprentice" | 5 workouts | `COUNT(*) FROM sessions WHERE finished_at IS NOT NULL` — trivial |
| Silver | "Routine de Fer" | "Iron Routine" | 25 workouts | Same query |
| Gold | "Démon des Salles" | "Gym Demon" | 50 workouts | Same query |
| Platinum | "Machine de Guerre" | "War Machine" | 100 workouts | Same query |
| Diamond | "Légende de la Fonte" | "Legend of the Iron" | 250 workouts | Same query |

**Status:** Ready. No new instrumentation needed.

### Group 2: "Volume King" (cumulative tonnage)

| Rank | Title (FR) | Title (EN) | Milestone | Feasibility |
|---|---|---|---|---|
| Bronze | "Sérieux, c'est tout ?" | "Is That All You Got?" | 1,000 kg | `SUM(weight_logged * reps_logged::int)` across all `set_logs` |
| Silver | "Déménageur du dimanche" | "Sunday Mover" | 10,000 kg | Same — but grows with history |
| Gold | "Titan du plateau" | "Plateau Titan" | 50,000 kg | Same |
| Platinum | "Forgeron d'Acier" | "Steel Forger" | 100,000 kg | Same |
| Diamond | "Dieu de l'Acier" | "God of Steel" | 250,000 kg | Same |

**Status:** Ready. Duration-based sets (`reps_logged IS NULL`) are excluded (no weight × reps). Query cost grows linearly with history — acceptable for MVP, consider a `user_lifetime_stats` materialized counter later if it becomes slow.

### Group 3: "Le Maître du Rythme" (rest interval respect)

| Rank | Title (FR) | Title (EN) | Milestone | Feasibility |
|---|---|---|---|---|
| Bronze | "Impatience chronique" | "Chronic Impatience" | 10 respected rests | See approach below |
| Silver | "Pendule humaine" | "Human Pendulum" | 50 respected rests | Same |
| Gold | "Le Métronome" | "The Metronome" | 150 respected rests | Same |
| Platinum | "Horloge Suisse" | "Swiss Clockwork" | 500 respected rests | Same |
| Diamond | "Seigneur du Temps" | "Lord of Time" | 1,000 respected rests | Same |

**Status: Unblocked** — with a lightweight instrumentation approach.

**Approach: `rest_seconds` on `set_logs` (fire-and-forget)**

Instead of making the rest timer persistent or tracking a boolean `rest_respected`, add a single optional column:

```
ALTER TABLE set_logs ADD COLUMN rest_seconds integer;
```

**Frontend instrumentation:** When the user taps "Done" to log a set, the front sends `rest_seconds`:

- **If the rest timer was active:** Use the timer's effective elapsed time (which already subtracts `accumulatedPause` via `getEffectiveElapsed` in `file:src/hooks/useRestTimer.ts`). This correctly excludes session pause time. Read from the rest timer state at log time.
- **If no rest timer was active:** `null` — don't send a value. We can't infer rest compliance without a prescribed rest period.
- **First set of a session:** `null` — no preceding rest to measure.

This avoids the trap of using raw `Date.now() - lastSetLoggedAt` which would include session pause time and produce inflated rest values.

**Backend badge logic:** The RPC compares `set_logs.rest_seconds` against the prescribed rest from `workout_exercises.rest_seconds` for that exercise. A set counts as "rest respected" when `set_logs.rest_seconds >= workout_exercises.rest_seconds * 0.8` (80% tolerance — nobody is a perfect stopwatch). The RPC counts how many sets across the user's lifetime meet this condition.

**Edge cases:**
- First set of a session: `rest_seconds = null` (no preceding rest) → excluded from count
- Quick sessions without prescribed rest: `workout_exercises.rest_seconds = 0` → excluded
- Quick sessions with no linked day: `sessions.workout_day_id IS NULL` → no `workout_exercises` to compare against, excluded from Rhythm metric entirely. This is correct: there's no prescribed rest to respect.
- Offline sets synced later: `rest_seconds` was captured at log time, still valid

### Group 4: "Le Chasseur de Records" (PRs)

| Rank | Title (FR) | Title (EN) | Milestone | Feasibility |
|---|---|---|---|---|
| Bronze | "Briseur de plafonds" | "Ceiling Breaker" | 1 PR | `COUNT(*) FROM set_logs WHERE was_pr = true` — trivial |
| Silver | "Chasseur de max" | "Max Hunter" | 5 PRs | Same |
| Gold | "Destructeur de max" | "Max Destroyer" | 15 PRs | Same |
| Platinum | "Fléau des records" | "Record Scourge" | 30 PRs | Same |
| Diamond | "Divinité de l'Acier" | "Iron Deity" | 50 PRs | Same |

**Status:** Ready. `was_pr` is already computed and stored.

### Group 5: "L'Architecte de Fibres" (exercise variety)

| Rank | Title (FR) | Title (EN) | Milestone | Feasibility |
|---|---|---|---|---|
| Bronze | "Curieux" | "The Curious One" | 5 unique exercises | `COUNT(DISTINCT exercise_id) FROM set_logs` joined through sessions |
| Silver | "Explorateur" | "The Explorer" | 10 unique exercises | Same |
| Gold | "Anatomiste" | "The Anatomist" | 20 unique exercises | Same |
| Platinum | "Maître des Fibres" | "Fiber Master" | 35 unique exercises | Same |
| Diamond | "Dr. Frankenstein" | "Dr. Frankenstein" | 50 unique exercises | Same |

**Status:** Ready. No new instrumentation needed.

---

## Architecture Decisions

### 1. Achievement checking: RPC after session finish (NOT a trigger)

**Rule: never put business logic in Postgres triggers.** If a badge-checking query fails (malformed SQL, edge case, timeout), it must NOT roll back or delay the session save. The session transaction must stay pure and fast.

| Approach | Verdict |
|---|---|
| ~~Postgres trigger on `sessions`~~ | **Rejected.** Couples badge logic to the session write transaction. A broken Diamond badge query could lose workout data. Harder to debug, harder to test. |
| **Explicit RPC called after session finish** | **Chosen.** Clean separation: session saves first (critical path), then the front calls `check_and_grant_achievements(user_id)` as a fire-and-forget. If it fails, the user just doesn't see the badge *yet* — no data loss. |

**Flow:**
1. Front finishes session → `syncService` upserts session with `finished_at` (critical path, must succeed)
2. On success, front calls `supabase.rpc('check_and_grant_achievements', { p_user_id })` (non-critical, fire-and-forget)
3. RPC computes all 5 metrics, compares against thresholds, inserts any newly-unlocked tiers
4. Supabase Realtime picks up the `INSERT` on `user_achievements` → overlay fires on the frontend

If step 2 fails (network, SQL error, timeout), the session is safely saved. The badge check can be retried on next session finish or on next app open (the RPC is idempotent).

### 2. Single RPC as badge engine: `check_and_grant_achievements`

This RPC is the **single source of truth** for badge logic. It:
- Computes all 5 aggregate metrics (session count, volume, PRs, unique exercises, respected rests)
- Compares against `achievement_tiers.threshold_value` from the DB
- Inserts newly-unlocked tiers with `ON CONFLICT DO NOTHING` (idempotent)
- Returns the list of newly-granted achievements (so the front can show overlays even without Realtime)

**Threshold changes = a DB migration, not an app redeploy.** The RPC reads thresholds dynamically from `achievement_tiers`. Change a threshold → all users are re-evaluated on their next session finish.

A companion RPC `get_badge_status(user_id)` serves the `BadgeGrid`: returns all groups/tiers with current progress percentages. The front just renders the result — zero badge logic on the client.

### 3. Real-time unlock feedback: Supabase Realtime

Enable Realtime on the `user_achievements` table (Supabase dashboard toggle). Frontend subscribes to `INSERT` events filtered by `user_id`. When a new row appears → render `AchievementUnlockOverlay`. The subscription lives in a global provider (active whenever authenticated), not tied to any specific page.

**Belt-and-suspenders:** The RPC also returns newly-granted achievements in its response. If Realtime misses an event (e.g., user was briefly offline), the front can still show overlays from the RPC response as a fallback.

### 4. Extensibility: data-driven definitions

Achievement groups and tiers live in DB tables, not in code. Adding a new tier or group = an INSERT migration. The RPC queries `achievement_tiers` dynamically, so no code changes are needed for new milestones.

### 5. Badge assets: AI-generated

Each rank gets a unique icon generated via AI (transparent PNG). Assets are stored in Supabase Storage (public bucket) and referenced via `achievement_tiers.icon_asset_url`. The rank frame is pure CSS. Prompts and compositing details are in the Badge Asset System section below.

---

## Data Model

### New tables

**`achievement_groups`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `slug` | `text UNIQUE NOT NULL` | e.g. `consistency_streak`, `volume_king`, `rhythm_master`, `record_hunter`, `exercise_variety` |
| `name_fr` | `text NOT NULL` | French display name |
| `name_en` | `text NOT NULL` | English display name |
| `description_fr` | `text` | French description of the group |
| `description_en` | `text` | English description of the group |
| `metric_type` | `text NOT NULL` | One of: `session_count`, `total_volume_kg`, `pr_count`, `unique_exercises`, `respected_rest_count` |
| `sort_order` | `int NOT NULL DEFAULT 0` | Display ordering |

**`achievement_tiers`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `group_id` | `uuid FK → achievement_groups.id` | `ON DELETE CASCADE` |
| `tier_level` | `int NOT NULL` | 1–5 — higher = harder |
| `rank` | `text NOT NULL` | One of: `bronze`, `silver`, `gold`, `platinum`, `diamond` |
| `title_fr` | `text NOT NULL` | French badge title (e.g. "Apprenti Courbaturé") |
| `title_en` | `text NOT NULL` | English badge title (e.g. "The Sore Apprentice") |
| `threshold_value` | `numeric NOT NULL` | Milestone value (5, 25, 1000, etc.) |
| `icon_asset_url` | `text` | URL to transparent PNG icon in Supabase Storage — nullable during dev |
| `UNIQUE(group_id, tier_level)` | | One tier level per group |

**`user_achievements`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `user_id` | `uuid FK → auth.users` | `ON DELETE CASCADE` |
| `tier_id` | `uuid FK → achievement_tiers.id` | `ON DELETE CASCADE` |
| `granted_at` | `timestamptz NOT NULL DEFAULT now()` | When the achievement was granted |
| `UNIQUE(user_id, tier_id)` | | Idempotency — same achievement can't be granted twice |

**RLS:** `user_achievements` → users can `SELECT` their own rows. `achievement_groups` and `achievement_tiers` → public `SELECT` (definitions are not user-specific). All `INSERT`/`UPDATE`/`DELETE` on `user_achievements` restricted to service role (RPC runs as `SECURITY DEFINER`).

### Schema change: `user_profiles.active_title_tier_id`

```sql
ALTER TABLE user_profiles
  ADD COLUMN active_title_tier_id uuid REFERENCES achievement_tiers(id) ON DELETE SET NULL;
```

The user's equipped title. Nullable — no title equipped by default. The referenced `achievement_tiers` row provides the localized title text (`title_fr`, `title_en`) and `rank` for styling.

**Ownership validation (server-side):** Enforced via a `BEFORE UPDATE OF active_title_tier_id` trigger on `user_profiles`. The trigger only fires when the column actually changes, and raises a `check_violation` if the user doesn't own the referenced tier. This is a data-validation trigger (like a CHECK constraint referencing another table), not the business-logic trigger we rejected for badge granting.

The existing `FOR ALL` RLS policy on `user_profiles` is untouched. The frontend can do a plain `supabase.from('user_profiles').update(...)` — the trigger rejects it at the DB layer if the user doesn't own the tier.

See Tech Plan for the full trigger SQL.

**Display:** Shown under `display_name` wherever the user's identity appears:
- Account page header (below name, styled with rank color)
- Session summary (subtle, under workout label)
- Potentially in future social/sharing features

**Auto-equip on first Diamond (frontend-driven):** When the overlay queue processes a Diamond-rank unlock, the frontend checks if `active_title_tier_id` is null. If so, it fires a `user_profiles.update({ active_title_tier_id: tier_id })` call — same path as manual equip, same RLS protection. This keeps the RPC focused on granting achievements only, and avoids mixing unrelated concerns (badge granting + profile updates) in one transaction.

### Schema change: `set_logs.rest_seconds`

```sql
ALTER TABLE set_logs ADD COLUMN rest_seconds integer;
```

Optional column. Populated by the front when logging a set: elapsed seconds since the previous set (or since the rest timer started). `NULL` for the first set of a session or when no timer was active.

### Required indexes

The RPCs scan `sessions` and `set_logs` per-user. Without proper indexes, these become sequential scans that degrade linearly with history — unusable after 50+ sessions.

```sql
CREATE INDEX IF NOT EXISTS idx_sessions_user_finished
  ON sessions (user_id, finished_at)
  WHERE finished_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_set_logs_session_id
  ON set_logs (session_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_was_pr
  ON set_logs (was_pr)
  WHERE was_pr = true;

CREATE INDEX IF NOT EXISTS idx_set_logs_rest_seconds
  ON set_logs (rest_seconds)
  WHERE rest_seconds IS NOT NULL;
```

**Rationale:**
- `idx_sessions_user_finished`: covers session count + all joins from `set_logs` → `sessions` filtered by user. Partial index (only finished sessions) keeps it compact.
- `idx_set_logs_session_id`: makes the `JOIN sessions s ON s.id = sl.session_id` fast. Likely already exists (FK), but worth verifying.
- `idx_set_logs_was_pr`: partial index for PR count — only indexes the `true` rows, so it's tiny and fast.
- `idx_set_logs_rest_seconds`: partial index for respected-rest count — only indexes rows with non-null rest data.

### RPC: `check_and_grant_achievements(p_user_id uuid)`

Called by the front after session finish. **Not a trigger** — fully decoupled from the session save transaction.

Uses a **single CTE pass** to compute all 5 metrics, then a single query to find and grant eligible tiers. Postgres optimizes CTEs efficiently — no redundant scans.

```sql
CREATE OR REPLACE FUNCTION check_and_grant_achievements(p_user_id uuid)
RETURNS TABLE (
  tier_id uuid, group_slug text, rank text,
  title_en text, title_fr text, icon_asset_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_sessions AS (
    SELECT s.id, s.workout_day_id
    FROM sessions s
    WHERE s.user_id = p_user_id AND s.finished_at IS NOT NULL
  ),
  metrics AS (
    SELECT 'session_count' AS metric_type, COUNT(*)::numeric AS value
      FROM user_sessions
    UNION ALL
    SELECT 'total_volume_kg',
      COALESCE(SUM(sl.weight_logged * sl.reps_logged::int), 0)
      FROM set_logs sl JOIN user_sessions us ON us.id = sl.session_id
      WHERE sl.reps_logged IS NOT NULL
    UNION ALL
    SELECT 'pr_count', COUNT(*)::numeric
      FROM set_logs sl JOIN user_sessions us ON us.id = sl.session_id
      WHERE sl.was_pr = true
    UNION ALL
    SELECT 'unique_exercises', COUNT(DISTINCT sl.exercise_id)::numeric
      FROM set_logs sl JOIN user_sessions us ON us.id = sl.session_id
    UNION ALL
    SELECT 'respected_rest_count', COUNT(*)::numeric
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      JOIN workout_exercises we
        ON we.exercise_id = sl.exercise_id
        AND we.workout_day_id = us.workout_day_id
      WHERE us.workout_day_id IS NOT NULL
        AND sl.rest_seconds IS NOT NULL
        AND we.rest_seconds > 0
        AND sl.rest_seconds >= we.rest_seconds * 0.8
  ),
  eligible AS (
    SELECT at.id, ag.slug, at.rank AS r, at.title_en, at.title_fr, at.icon_asset_url
    FROM metrics m
    JOIN achievement_groups ag ON ag.metric_type = m.metric_type
    JOIN achievement_tiers at ON at.group_id = ag.id
    WHERE at.threshold_value <= m.value
      AND NOT EXISTS (
        SELECT 1 FROM user_achievements ua
        WHERE ua.user_id = p_user_id AND ua.tier_id = at.id
      )
  ),
  granted AS (
    INSERT INTO user_achievements (user_id, tier_id)
    SELECT p_user_id, e.id FROM eligible e
    ON CONFLICT (user_id, tier_id) DO NOTHING
    RETURNING user_achievements.tier_id
  )
  SELECT e.id, e.slug, e.r, e.title_en, e.title_fr, e.icon_asset_url
  FROM eligible e
  JOIN granted g ON g.tier_id = e.id;
END;
$$;
```

**Key properties:**
- **Single CTE pass:** `user_sessions` is computed once and reused by all 5 metric subqueries — Postgres materializes it, avoiding redundant `sessions` scans.
- **Idempotent:** `ON CONFLICT DO NOTHING` + `NOT EXISTS` — safe to call multiple times for the same session.
- **Returns only newly-granted achievements:** The `granted` CTE captures what was actually inserted, then joins back to return full tier info. The front can show overlays directly from the response (belt-and-suspenders alongside Realtime).
- **Decoupled from session save:** If this RPC fails, the session is already safely persisted. Badge check can be retried.
- **`SET search_path = public`:** Mandatory for `SECURITY DEFINER` functions — prevents search-path injection attacks.

### RPC: `get_badge_status(p_user_id uuid)`

Serves the `BadgeGrid`. Returns all groups → tiers with current metric values and progress. The front does **zero** badge logic — it just renders what the server returns.

```sql
-- Same CTE pattern as check_and_grant_achievements, but:
--   - Returns ALL tiers (not just newly unlocked)
--   - Includes current_value, threshold_value, progress_pct per tier
--   - LEFT JOINs user_achievements to include unlocked_at (null if locked)
-- Also SET search_path = public (SECURITY DEFINER)
```

Exact SQL to be finalized in Tech Plan — follows the same CTE pattern as `check_and_grant_achievements` but includes all tiers (not just unlocked ones) and computes `progress_pct = LEAST(1.0, current_value / threshold_value)`.

**Performance note:** With the indexes above, the 5 aggregate queries use index scans on `sessions(user_id, finished_at)` and partial indexes on `set_logs`. For a typical user (< 500 sessions, < 10k set_logs), this is sub-50ms. If it becomes a bottleneck at scale, introduce a `user_lifetime_stats` materialized row. Not needed at MVP scale — optimize when profiling shows it matters.

---

## Rank System

All groups share the same 5-rank ladder. The `rank` column on `achievement_tiers` stores the canonical rank name. The frontend uses rank to determine badge frame color/effect:

| `tier_level` | `rank` | Frame color | Visual treatment |
|---|---|---|---|
| 1 | `bronze` | Warm copper-brown | Matte, minimalist engraving |
| 2 | `silver` | Cool silver-grey | Polished, bolder engraving |
| 3 | `gold` | Rich gold | Metallic sheen, dramatic iconography |
| 4 | `platinum` | Blue-white platinum | Iridescent shimmer, ornate details |
| 5 | `diamond` | Prismatic diamond glow | Radiant particle effects, legendary feel |

### Full Title Reference (FR + EN)

| Group | Rank | French | English | Threshold |
|---|---|---|---|---|
| Consistency | Bronze | "Apprenti Courbaturé" | "The Sore Apprentice" | 5 workouts |
| Consistency | Silver | "Routine de Fer" | "Iron Routine" | 25 workouts |
| Consistency | Gold | "Démon des Salles" | "Gym Demon" | 50 workouts |
| Consistency | Platinum | "Machine de Guerre" | "War Machine" | 100 workouts |
| Consistency | Diamond | "Légende de la Fonte" | "Legend of the Iron" | 250 workouts |
| Volume | Bronze | "Sérieux, c'est tout ?" | "Is That All You Got?" | 1,000 kg |
| Volume | Silver | "Déménageur du dimanche" | "Sunday Mover" | 10,000 kg |
| Volume | Gold | "Titan du plateau" | "Plateau Titan" | 50,000 kg |
| Volume | Platinum | "Forgeron d'Acier" | "Steel Forger" | 100,000 kg |
| Volume | Diamond | "Dieu de l'Acier" | "God of Steel" | 250,000 kg |
| Rhythm | Bronze | "Impatience chronique" | "Chronic Impatience" | 10 rests |
| Rhythm | Silver | "Pendule humaine" | "Human Pendulum" | 50 rests |
| Rhythm | Gold | "Le Métronome" | "The Metronome" | 150 rests |
| Rhythm | Platinum | "Horloge Suisse" | "Swiss Clockwork" | 500 rests |
| Rhythm | Diamond | "Seigneur du Temps" | "Lord of Time" | 1,000 rests |
| Records | Bronze | "Briseur de plafonds" | "Ceiling Breaker" | 1 PR |
| Records | Silver | "Chasseur de max" | "Max Hunter" | 5 PRs |
| Records | Gold | "Destructeur de max" | "Max Destroyer" | 15 PRs |
| Records | Platinum | "Fléau des records" | "Record Scourge" | 30 PRs |
| Records | Diamond | "Divinité de l'Acier" | "Iron Deity" | 50 PRs |
| Variety | Bronze | "Curieux" | "The Curious One" | 5 exercises |
| Variety | Silver | "Explorateur" | "The Explorer" | 10 exercises |
| Variety | Gold | "Anatomiste" | "The Anatomist" | 20 exercises |
| Variety | Platinum | "Maître des Fibres" | "Fiber Master" | 35 exercises |
| Variety | Diamond | "Dr. Frankenstein" | "Dr. Frankenstein" | 50 exercises |

---

## Frontend Components

### 1. `AchievementRealtimeProvider`

Global provider (rendered in `App` or `AppShell` when authenticated). Two responsibilities:

**Realtime subscription:** Subscribes to Supabase Realtime on `user_achievements` table, filtered by `user_id`. On `INSERT` event:
1. Fetch the full tier + group info (join `achievement_tiers` + `achievement_groups`)
2. Push the unlocked achievement into a Jotai queue atom (`achievementUnlockQueueAtom`)

**Overlay orchestration:** Reads from the queue atom. When non-empty, renders `AchievementUnlockOverlay` for the first item. On dismiss (auto or tap), shifts the queue and shows the next one (if any) after a 500ms delay.

**Deduplication:** Since both the RPC response and Realtime can produce the same unlock event, the queue atom deduplicates by `tier_id` before pushing — if a `tier_id` is already in the queue or was already shown this session, it's silently dropped.

### 2. `AchievementUnlockOverlay`

**Not a toast.** This is a full-screen takeover moment — the user just hit a milestone, and it should *feel* like a loot drop. A standard corner notification would be anticlimactic for something you've been grinding toward for weeks.

**Implementation:** Radix Dialog (already installed) rendered as a programmatic modal — no trigger element, opened imperatively via state. The `AchievementRealtimeProvider` sets the unlocked achievement in a Jotai atom; the overlay reads it and renders when non-null.

**Visual sequence (all CSS — no framer-motion):**

1. **Backdrop:** Dark semi-transparent overlay fades in (`animate-in fade-in` from `tailwindcss-animate`)
2. **Badge reveal:** The badge image scales up from 0 → 100% with a spring-like overshoot (`@keyframes badge-reveal` — custom CSS: `scale(0) → scale(1.15) → scale(1)` over ~600ms with `cubic-bezier(0.34, 1.56, 0.64, 1)`)
3. **Rank glow:** A rank-colored radial gradient pulse behind the badge (`@keyframes rank-glow` — opacity 0 → 0.8 → 0.4 with a blur), color mapped from the rank system (bronze warm, gold rich, diamond prismatic)
4. **Particle burst:** CSS-only particle effect using multiple `box-shadow` values on a pseudo-element, animating outward from center (`@keyframes particle-burst`). 8–12 dots in rank color, fading out at edges. Lightweight, no canvas/JS.
5. **Text entrance:** Title + rank slide up with staggered delay (`animate-in slide-in-from-bottom` with `animation-delay`):
   - Achievement title (large, bold)
   - Rank label with colored pill (e.g. "Gold" in gold)
   - Group name (smaller, muted)
6. **Auto-dismiss:** Overlay closes after ~4 seconds, or on tap/click anywhere. Closing animation is a quick fade-out + scale-down.

**Multiple unlocks in one session:** If a session triggers multiple achievements (e.g., hitting both a Volume and a Consistency milestone), queue them. Show one at a time with a ~500ms gap between dismiss and next reveal.

**Haptic feedback:** Call `navigator.vibrate([100, 50, 200])` on reveal (same pattern as rest timer finish, but heavier). Beep via Web Audio — a satisfying two-tone ascending chime (reuse `playBeep` pattern from `file:src/hooks/useRestTimer.ts` with frequencies like 523 Hz → 784 Hz, C5 → G5).

**Accessibility:** The Dialog sets `role="alertdialog"` and `aria-label` with the achievement title. Screen readers announce the title + rank. The overlay is dismissible via Escape key (Radix handles this).

### 3. `BadgeGrid`

Displayed on the Account page (`/account`). Shows all achievement groups as sections, each with its tier progression:
- Unlocked tiers: full color, badge image, title, unlock date
- Next tier: dimmed/greyed, progress indicator (e.g. "12/25 workouts")
- Locked future tiers: silhouette/outline only

**Data fetching:** React Query hook `useBadgeStatus()` wrapping the `get_badge_status(user_id)` RPC. Returns all groups → tiers with `unlocked_at`, `current_value`, `threshold_value`, and `progress_pct`. The front does **zero** badge logic — it just renders what the server returns.

### 4. `BadgeDetailSheet`

Bottom sheet opened when tapping a badge in the grid. Shows:
- Large badge image (CSS frame + icon)
- Title + description
- Unlock date (or "Locked — X more to go")
- Group context (which group, what rank, next milestone)
- **"Equip title" button** (only for unlocked badges): sets this achievement's title as the user's active title (`user_profiles.active_title_tier_id`). If the tapped badge is already the active title, show "Unequip" instead. Simple `supabase.from('user_profiles').update(...)` call.

### 5. Session summary — newly unlocked badges

After a workout finishes, the session summary screen shows any badges unlocked during that session. Data comes directly from the `check_and_grant_achievements` RPC response (already available — no extra call). If nothing was unlocked, the section doesn't render.

- Compact row: badge icon(s) with CSS rank frame + title + rank pill
- Tappable → opens `BadgeDetailSheet`
- Rendered below existing session stats (sets, volume, PRs, duration)

**Cost:** Near-zero — reads from the RPC response already in memory. One small presentational component.

### 6. Account page header — badge showcase

A compact achievement summary at the top of the Account page, integrated with the existing profile section. Gives achievements ambient presence without requiring the user to scroll to the full `BadgeGrid`.

- **Active title** displayed under `display_name`, styled with rank color (e.g. "Legend of the Iron" in gold text). If no title equipped, this line doesn't render.
- "X / 25 unlocked" counter pill
- Row of 5 small badge icons (one per group) showing the highest unlocked rank for each group. Groups with no unlocks show a locked placeholder.
- Tappable → scrolls to `BadgeGrid`

**Cost:** Near-zero — reads from the same `useBadgeStatus()` cache that powers `BadgeGrid` + `active_title_tier_id` from `user_profiles` (already fetched for the Account page). One thin component.

---

## Badge Asset System

### Architecture: CSS frames + AI icon compositing

Badges are **not** monolithic images. Each badge is composited at render time from two independent layers:

- **Frame (rank layer) — pure CSS.** No image assets. `conic-gradient`, `box-shadow`, border treatments, and pseudo-element animations produce all 5 rank frames. Deterministic, theme-aware, instantly tweakable.
- **Icon (group × rank layer) — AI-generated transparent PNGs.** Just the central icon on a transparent background, overlaid on the CSS frame. 25 total (5 per group).

**Why this is better than 25 baked images:**

| | Baked images (rejected) | CSS frame + icon overlay (chosen) |
|---|---|---|
| New group | 5 new full images | 5 new icon PNGs (frames are free) |
| New rank | 5+ new full images (one per group) | 1 new CSS class (all groups get it) |
| Frame tweak | Re-generate all images at that rank | Edit CSS, instant |
| Locked/dimmed state | Separate greyed-out images, or runtime filter | CSS filter: `grayscale(1) opacity(0.4)` |
| Overlay animation | Animate one `<img>` | Animate frame glow and icon scale-in independently |
| Dark/light theme | Two sets of images, or runtime filter | CSS custom properties adjust frame colors |
| Storage cost | 25 × ~200kb = ~5MB | 25 × ~100kb icons + 0kb CSS = ~2.5MB |

### Badge component structure

```tsx
<div className={cn("badge-frame", `badge-frame-${rank}`)}>
  <img
    src={icon_asset_url}
    className="badge-icon"
    alt={title}
  />
</div>
```

### CSS frame specifications

| Rank | CSS technique | Key properties |
|---|---|---|
| Bronze | `conic-gradient` warm copper tones | Matte finish, thin border, `box-shadow: inset` for subtle depth |
| Silver | `conic-gradient` cool silver tones | Polished sheen via `background-blend-mode`, medium border |
| Gold | `conic-gradient` + radial glow pseudo-element | Filigree border via repeating pattern, warm `box-shadow` glow |
| Platinum | `conic-gradient` blue-white + `backdrop-filter` | Double border, iridescent shimmer via `@keyframes` hue rotation |
| Diamond | `conic-gradient` prismatic rainbow | `@keyframes` rotation on gradient, particle pseudo-elements, prismatic `box-shadow` |

CSS custom properties per rank (used by frame, overlay glow, and particle burst):

```css
.badge-frame-bronze  { --badge-hue: 30;  --badge-sat: 80%; --badge-glow: none; }
.badge-frame-silver  { --badge-hue: 210; --badge-sat: 10%; --badge-glow: 0 0 8px rgba(200,200,220,0.3); }
.badge-frame-gold    { --badge-hue: 45;  --badge-sat: 90%; --badge-glow: 0 0 12px rgba(234,179,8,0.4); }
.badge-frame-platinum { --badge-hue: 200; --badge-sat: 30%; --badge-glow: 0 0 16px rgba(148,163,184,0.5); }
.badge-frame-diamond { --badge-hue: 280; --badge-sat: 70%; --badge-glow: 0 0 24px rgba(168,85,247,0.4), 0 0 48px rgba(103,232,249,0.2); }
```

These same variables drive the `AchievementUnlockOverlay`'s rank glow, particle burst colors, and pill label color — single source of truth for rank aesthetics.

### DB schema impact

The `achievement_tiers.icon_asset_url` column stores the **icon URL** (transparent PNG). The frame is rendered client-side via CSS from the `rank` column.

### Icon matrix (group × rank)

| | Bronze | Silver | Gold | Platinum | Diamond |
|---|---|---|---|---|---|
| **Consistency** | dumbbell + flame | crossed dumbbells | demon skull + barbell | war machine crest | crown + laurel wreath |
| **Volume** | weight plate | stacked plates + dolly | Atlas + globe | anvil + molten steel | divine steel figure |
| **Rhythm** | hourglass | pendulum | metronome + sound waves | Swiss watch gears | cosmic clock |
| **Records** | fist through glass | crosshair + arrow | explosion + PR marker | lightning + anvil | hammer + mountain |
| **Variety** | magnifying glass | compass rose | Vitruvian man | anatomy blueprint | Frankenstein monster |

### AI icon generation prompts

Icons are generated **without any frame/border** — just the subject on a transparent background. The prompt template:

```
"[ICON_DESCRIPTION], [STYLE_LEVEL] style, centered composition,
transparent background, game UI icon asset, no border, no frame,
no text, high detail, 512×512 PNG"
```

`STYLE_LEVEL` escalates with rank: minimalist → bold → dramatic → luxurious → epic.

**Consistency Streak**

| Rank | Icon prompt |
|---|---|
| Bronze | "a single dumbbell with a small flickering flame, minimalist style" |
| Silver | "crossed dumbbells bound with iron chain links, bold style" |
| Gold | "a demon skull with horns gripping a heavy barbell, dramatic style" |
| Platinum | "a war machine crest with gears, barbells, and armored fists, luxurious style" |
| Diamond | "a legendary crown forged from barbells and laurel wreath, radiating energy, epic style" |

**Volume King**

| Rank | Icon prompt |
|---|---|
| Bronze | "a single small weight plate, minimalist style" |
| Silver | "stacked weight plates on a hand truck / dolly, bold style" |
| Gold | "Atlas holding a massive barbell-shaped globe, dramatic style" |
| Platinum | "a blacksmith's anvil with molten steel pouring over weight plates, luxurious style" |
| Diamond | "a divine figure made of pure steel beams, radiating shockwaves of power, epic style" |

**Rhythm Master**

| Rank | Icon prompt |
|---|---|
| Bronze | "a simple hourglass with sand falling, a few grains mid-air, minimalist style" |
| Silver | "a swinging pendulum with motion trails, bold style" |
| Gold | "a metronome with radiating concentric sound waves, dramatic style" |
| Platinum | "an intricate Swiss watch mechanism with interlocking gears, precise and ornate, luxurious style" |
| Diamond | "an all-seeing cosmic clock face with orbiting celestial bodies as hour markers, time bending around it, epic style" |

**Record Hunter**

| Rank | Icon prompt |
|---|---|
| Bronze | "a fist punching through a glass ceiling, cracks radiating outward, minimalist style" |
| Silver | "a crosshair targeting a PR marker with an arrow piercing it, bold style" |
| Gold | "an explosion shattering a barbell max marker into fragments, dramatic style" |
| Platinum | "a lightning bolt striking an anvil, sparks erupting, luxurious style" |
| Diamond | "a divine hammer smashing through a mountain peak, shockwave rings, epic style" |

**Exercise Variety**

| Rank | Icon prompt |
|---|---|
| Bronze | "a magnifying glass hovering over a simple muscle anatomy sketch, minimalist style" |
| Silver | "a compass rose with muscle group icons at each cardinal point, bold style" |
| Gold | "a da Vinci Vitruvian Man silhouette with highlighted muscle groups, dramatic style" |
| Platinum | "an anatomical blueprint with interconnected muscle fibers glowing, luxurious style" |
| Diamond | "a Frankenstein's monster assembled from different glowing muscle groups, electricity arcing between stitches, epic style" |

---

## Reusable Infrastructure

| Existing asset | How it helps |
|---|---|
| `syncService.ts` set_log upsert flow | Touch point for `rest_seconds` — add the field to the upsert payload |
| `useRestTimer` hook | Source of elapsed rest duration to compute `rest_seconds` at set-log time |
| Radix Dialog | Programmatic modal for `AchievementUnlockOverlay` — already installed |
| `playBeep` pattern in `useRestTimer` | Web Audio chime for unlock feedback — reuse the oscillator + gain approach |
| React Query patterns | `useBadgeStatus` hook follows established query/cache patterns |
| Jotai atoms | `achievementUnlockQueueAtom` — overlay queue with deduplication by `tier_id` |
| `get_cycle_stats` RPC | SQL pattern precedent for the achievement RPCs' aggregate queries |
| Supabase Storage | Existing infra for badge asset hosting |
| `tailwindcss-animate` | Entrance animations for toast + badge grid without adding framer-motion |

---

## Existing Users — Retroactive Badge Grant

Existing users already have session history, volume, PRs, and exercise variety that qualifies for badges. Ignoring this would penalize early adopters.

**Strategy: one-off post-migration seed script.**

After the schema migration + tier seed data are applied, run:

```sql
SELECT check_and_grant_achievements(id) FROM user_profiles;
```

This leverages the same idempotent RPC we already built. It computes metrics from raw `sessions` / `set_logs` data and grants every badge each user has retroactively earned.

**UX implications:**

- **No overlay flood** — badges are inserted server-side before the frontend Realtime subscription is active. No events fire, no catch-up toast storm.
- **User opens the app** → sees their `BadgeGrid` pre-populated. A pleasant "oh, I already earned stuff" discovery moment.
- **Rhythm Master (rest compliance)** — `rest_seconds` is `NULL` for all historical `set_logs`. This group only counts going forward. Acceptable trade-off: we can't retroactively infer whether someone respected their rest 6 months ago.
- **Titles** — `active_title_tier_id` stays `NULL`. No auto-equip during the migration — the auto-equip logic is frontend-driven and only triggers on *new* Diamond unlocks via the overlay queue. Users discover the title system organically.

**Performance:** For a small user base (< 100 users), this runs in seconds. The CTE-based RPC is already indexed. If the user base grows significantly before launch, batch with `LIMIT/OFFSET` — but that's unlikely to matter here.

---

## Phasing

### Phase 1 (this epic)

- Schema: all 3 tables + `set_logs.rest_seconds` column + `user_profiles.active_title_tier_id` FK + seed data for **5 groups (25 tiers total — 5 ranks per group)**
- RPCs: `check_and_grant_achievements` (fire-and-forget after session finish) + `get_badge_status` (serves BadgeGrid)
- `rest_seconds` instrumentation: send elapsed rest with each set log via `syncService` (pause-aware, reads from timer state)
- Realtime: subscription on `user_achievements` for unlock overlays + deduplication by `tier_id`
- Frontend: `AchievementUnlockOverlay`, `BadgeGrid` on Account page, `BadgeDetailSheet` with equip/unequip title action
- Title system: active title on Account header, auto-equip first Diamond (frontend-driven)
- Session summary: newly unlocked badges section after workout finish
- Badge system: 5 CSS rank frames + 25 AI-generated icon PNGs (transparent), uploaded to Supabase Storage
- i18n: FR + EN for all titles, descriptions, overlay messages, title system labels

### Phase 2 (future)

- **`user_lifetime_stats`** materialized table: running totals for O(1) achievement checking (optimization, not needed at MVP scale)
- **Streak-based achievements**: "X workouts in a row without missing a week" — requires date-gap analysis
- **Social sharing**: share unlocked badges as images

---

## Technical Tasks (estimated)

| # | Task | Effort | Notes |
|---|---|---|---|
| 1 | DB migration: `achievement_groups`, `achievement_tiers`, `user_achievements` tables + RLS | S | 3 tables, straightforward |
| 2 | DB migration: add `rest_seconds integer` to `set_logs` | XS | Single column, nullable, no backfill needed |
| 3 | DB migration: composite indexes on `sessions(user_id, finished_at)`, `set_logs(session_id)`, partial indexes on `set_logs(was_pr)` and `set_logs(rest_seconds)` | S | Critical for RPC performance — prevents seq scans |
| 4 | Seed migration: insert 5 groups + 25 tiers (5 ranks each) with FR/EN titles and thresholds | S | Data-only migration |
| 5 | RPC `check_and_grant_achievements(p_user_id)`: CTE-based, compute 5 metrics, grant new tiers, return newly-unlocked | M | Core badge engine; idempotent; `SECURITY DEFINER` + `SET search_path = public` |
| 6 | RPC `get_badge_status(p_user_id)`: return all groups/tiers with progress % | S | Serves BadgeGrid; same CTE pattern as task 5 |
| 7 | Enable Supabase Realtime on `user_achievements` | XS | Dashboard toggle + config |
| 8 | Instrument `syncService` to send `rest_seconds` in set_log upsert | S | Pause-aware: reads effective elapsed from `useRestTimer` state, not raw wall-clock. `null` for first set or when no timer was active. |
| 9 | TypeScript types for achievement entities | S | `file:src/types/database.ts` additions |
| 10 | React Query hook `useBadgeStatus` (grid data + progress) | S | Wraps `get_badge_status` RPC |
| 11 | Hook: call `check_and_grant_achievements` after session finish (fire-and-forget) | S | Non-critical path; retry-safe |
| 12 | `AchievementRealtimeProvider` — global Realtime subscription + overlay queue | M | New pattern in codebase; needs auth-gating, cleanup |
| 13 | `AchievementUnlockOverlay` component + custom CSS keyframes + audio chime | M | Full-screen reveal: badge scale-in, rank glow, particle burst, staggered text. Queue support for multiple unlocks. |
| 14 | `BadgeGrid` component on Account page | M | Sections per group, rank progression, progress bars |
| 15 | `BadgeDetailSheet` — bottom sheet for badge details | S | Reuse existing sheet patterns |
| 16 | Session summary: newly unlocked badges section | S | Reads from RPC response already in memory; thin presentational component |
| 17 | Account page header: active title + badge showcase (X/25 counter + top-rank icons) | S | Reads from `useBadgeStatus` cache + `user_profiles`; thin component |
| 18 | DB migration: add `active_title_tier_id uuid` FK to `user_profiles` | XS | Nullable, `ON DELETE SET NULL` |
| 19 | "Equip/Unequip title" action in `BadgeDetailSheet` | S | Plain `update` on `user_profiles.active_title_tier_id`; ownership enforced by `BEFORE UPDATE` trigger — no RPC needed |
| 20 | CSS badge frames: 5 rank classes (`badge-frame-{rank}`) + CSS custom properties | S | Pure CSS, no images; powers frame, overlay glow, and particle colors |
| 21 | AI icon generation (25 transparent PNGs) + upload to Supabase Storage | M | Using prompts from this doc; 5 per group × 5 groups |
| 22 | i18n keys (FR + EN): overlay messages, grid labels, detail sheet text, title system | S | New `achievements` namespace |
| 23 | Unit tests: RPCs (integration test via seed data + session finish + RPC call) | M | Critical — validate metric computation + idempotency |
| 24 | Update seed migration with `icon_asset_url` after image upload | XS | Once icons are in Storage |
| 25 | Post-migration script: retroactive badge grant for existing users | XS | `SELECT check_and_grant_achievements(id) FROM user_profiles;` — runs once after deploy |

**Total estimate:** M–L overall. The novelty is the RPC architecture + Realtime + overlay UX, not the data model.

---

## Acceptance Criteria

- [ ] 3 new tables exist: `achievement_groups`, `achievement_tiers`, `user_achievements`
- [ ] `set_logs.rest_seconds` column exists (nullable integer)
- [ ] Composite index on `sessions(user_id, finished_at)` and partial indexes on `set_logs(was_pr)`, `set_logs(rest_seconds)` exist
- [ ] 5 achievement groups seeded with 25 total tiers (5 ranks per group: Bronze → Silver → Gold → Platinum → Diamond)
- [ ] `check_and_grant_achievements` RPC correctly computes all 5 metrics (session count, total volume, PR count, unique exercises, respected rests)
- [ ] RPC is called after session finish as fire-and-forget — session save is never blocked by badge logic
- [ ] RPC inserts newly-unlocked tiers into `user_achievements` with idempotency (calling twice for the same session doesn't duplicate)
- [ ] RPC returns newly-granted achievements for immediate frontend use
- [ ] `get_badge_status` RPC returns all groups/tiers with current progress percentages
- [ ] Achievement state is queryable directly from the DB (`SELECT * FROM user_achievements WHERE user_id = ...`)
- [ ] `rest_seconds` is sent with each set log via `syncService` — pause-aware (reads effective elapsed from timer state), `null` for first set or when no rest timer was active
- [ ] `AchievementUnlockOverlay` appears as a full-screen takeover when an achievement is unlocked
- [ ] Overlay includes badge scale-in animation, rank-colored glow, particle burst, and staggered text reveal
- [ ] Multiple achievements unlocked in one session are queued and shown sequentially
- [ ] Overlay auto-dismisses after ~4s or on tap/Escape
- [ ] `BadgeGrid` on Account page shows all 5 groups with rank progression (unlocked, next, locked states)
- [ ] Progress toward next rank is displayed (e.g. "12/25 workouts")
- [ ] `BadgeDetailSheet` shows full badge info on tap
- [ ] Session summary shows newly unlocked badges (if any) after workout finish
- [ ] Account page header shows badge showcase (X/25 counter + highest-rank icon per group + active title)
- [ ] User can equip/unequip a title from `BadgeDetailSheet` on any unlocked badge
- [ ] Active title displays under `display_name` on Account page, styled with rank color
- [ ] First Diamond unlock auto-equips the title if none is set
- [ ] 5 CSS rank frames render correctly (Bronze → Diamond) with gradients, borders, and ambient effects
- [ ] Each rank × group has an AI-generated transparent icon PNG served from Supabase Storage
- [ ] Badge compositing works: CSS frame + icon overlay renders a complete badge
- [ ] All user-facing text available in FR and EN
- [ ] New achievements can be added via DB migration (INSERT) without frontend code changes
- [ ] Existing users receive retroactive badges on deploy (all groups except Rhythm Master, which requires `rest_seconds` data)
- [ ] Retroactive grant does not trigger overlay floods — badges appear silently in the grid
- [ ] No dependency on third-party analytics for unlocking
- [ ] RLS: users can only read their own `user_achievements`; tier/group definitions are publicly readable
- [ ] No regression on existing session finishing flow or sync service
- [ ] If `check_and_grant_achievements` RPC fails, the session is still safely saved

---

## Resolved Questions

All architectural questions have been decided. Documenting decisions for Tech Plan reference.

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | RPC performance at scale | **Ship as-is, optimize later** | For 500 sessions, ~100ms is imperceptible — the front already has the 200 OK from the session save. If a power user hits 10k sessions, introduce `user_lifetime_stats` then. Don't optimize prematurely for tomorrow's success. |
| 2 | Realtime subscription scope | **Global provider** | The overlay must fire at the exact moment of the action. A lazy subscription (only on Account page) loses 50% of the psychological impact. The gratification moment IS the feature. |
| 3 | Badge grid placement | **Account page** | That's where the user manages their identity. History page must stay action/data-oriented — don't overload it. |
| 4 | Offline session finish | **Silent** | Badge appears in the grid once sync completes. No catch-up overlay. A toast popping up 3 days after the workout is confusing, not rewarding. Industry standard behavior. |
| 5 | Threshold tuning | **Ship current values, adjust in 1 month** | The architecture supports `UPDATE achievement_tiers SET threshold_value = ...` at any time without breaking the app. Calibrate with real user data, not guesses. |
| 6 | Adding new achievements | **SQL migrations only (Phase 1)** | New groups/tiers = an INSERT migration + badge asset upload to Supabase Storage. Version-controlled, reviewable in PRs, zero frontend work. Admin UI deferred to Phase 2 — the existing `/admin` infra (`AdminGuard`, admin pages pattern) makes it a small lift when self-service is needed. |

### Remaining open (for Tech Plan)

1. **`rest_seconds` precision on offline sets:** When sets are queued offline in `syncService`, the `rest_seconds` value is computed at log time (client-side). This is accurate regardless of when the sync actually happens — confirm this holds in all offline flows.

---

## Out of Scope (future evolution)

- **Streak-based achievements** (consecutive weeks without missing — requires date-gap analysis)
- **Social sharing** (share badge as image to social media)
- **Leaderboards** (cross-user achievement comparison)
- **Achievement notifications via push** (currently overlay-only, no push/PWA notifications)
- **`user_lifetime_stats` materialized table** (optimization for O(1) metric lookups — not needed at MVP scale)
- **Admin page for achievements** (`/admin/achievements`) — CRUD UI for groups/tiers with inline badge upload. Existing `AdminGuard` + admin page pattern makes this a small lift when self-service is needed.
