-- Achievement groups: each group tracks one metric (session_count, volume, etc.)
CREATE TABLE achievement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_fr text NOT NULL,
  name_en text NOT NULL,
  description_fr text,
  description_en text,
  metric_type text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE achievement_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read achievement groups"
  ON achievement_groups FOR SELECT USING (true);

-- Achievement tiers: 5 ranks per group (bronze → diamond)
CREATE TABLE achievement_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES achievement_groups(id) ON DELETE CASCADE,
  tier_level int NOT NULL,
  rank text NOT NULL,
  title_fr text NOT NULL,
  title_en text NOT NULL,
  threshold_value numeric NOT NULL,
  icon_asset_url text,
  UNIQUE(group_id, tier_level)
);

ALTER TABLE achievement_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read achievement tiers"
  ON achievement_tiers FOR SELECT USING (true);

-- User achievements: granted badges (one row per user × tier)
CREATE TABLE user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES achievement_tiers(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tier_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own achievements"
  ON user_achievements FOR SELECT USING (auth.uid() = user_id);

-- Performance indexes for the CTE-based RPCs
CREATE INDEX IF NOT EXISTS idx_sessions_user_finished
  ON sessions (user_id, finished_at) WHERE finished_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_set_logs_session_id
  ON set_logs (session_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_was_pr
  ON set_logs (was_pr) WHERE was_pr = true;

-- idx_set_logs_rest_seconds lives in migration 000002 (after the column is added)
