-- =============================================================
-- Rebalance achievement thresholds (exponential curve)
-- Replace "respected rest count" metric with "active weeks"
-- (calendar weeks with 3+ finished sessions)
-- =============================================================

-- 1. Wipe existing user_achievements so everyone gets re-evaluated
--    under the new curve. Safe for early-stage product.
DELETE FROM user_achievements;

-- 2. Switch rhythm_master from respected_rest_count → active_weeks
UPDATE achievement_groups
SET metric_type    = 'active_weeks',
    description_fr = 'Semaines calendaires avec 3+ séances',
    description_en = 'Calendar weeks with 3+ sessions'
WHERE slug = 'rhythm_master';

-- 3. Rebalance ALL thresholds
-- Consistency Streak: 5 → 25 → 100 → 365 → 1000
UPDATE achievement_tiers SET threshold_value = 5
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'consistency_streak') AND tier_level = 1;
UPDATE achievement_tiers SET threshold_value = 25
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'consistency_streak') AND tier_level = 2;
UPDATE achievement_tiers SET threshold_value = 100
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'consistency_streak') AND tier_level = 3;
UPDATE achievement_tiers SET threshold_value = 365
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'consistency_streak') AND tier_level = 4;
UPDATE achievement_tiers SET threshold_value = 1000
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'consistency_streak') AND tier_level = 5;

-- Volume King: 1K → 25K → 150K → 500K → 2M
UPDATE achievement_tiers SET threshold_value = 1000
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'volume_king') AND tier_level = 1;
UPDATE achievement_tiers SET threshold_value = 25000
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'volume_king') AND tier_level = 2;
UPDATE achievement_tiers SET threshold_value = 150000
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'volume_king') AND tier_level = 3;
UPDATE achievement_tiers SET threshold_value = 500000
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'volume_king') AND tier_level = 4;
UPDATE achievement_tiers SET threshold_value = 2000000
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'volume_king') AND tier_level = 5;

-- Rhythm Master (now active_weeks): 2 → 8 → 25 → 52 → 150
UPDATE achievement_tiers SET threshold_value = 2
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'rhythm_master') AND tier_level = 1;
UPDATE achievement_tiers SET threshold_value = 8
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'rhythm_master') AND tier_level = 2;
UPDATE achievement_tiers SET threshold_value = 25
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'rhythm_master') AND tier_level = 3;
UPDATE achievement_tiers SET threshold_value = 52
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'rhythm_master') AND tier_level = 4;
UPDATE achievement_tiers SET threshold_value = 150
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'rhythm_master') AND tier_level = 5;

-- Record Hunter: 1 → 10 → 50 → 200 → 500
UPDATE achievement_tiers SET threshold_value = 1
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'record_hunter') AND tier_level = 1;
UPDATE achievement_tiers SET threshold_value = 10
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'record_hunter') AND tier_level = 2;
UPDATE achievement_tiers SET threshold_value = 50
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'record_hunter') AND tier_level = 3;
UPDATE achievement_tiers SET threshold_value = 200
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'record_hunter') AND tier_level = 4;
UPDATE achievement_tiers SET threshold_value = 500
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'record_hunter') AND tier_level = 5;

-- Exercise Variety: 5 → 15 → 40 → 100 → 200
UPDATE achievement_tiers SET threshold_value = 5
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'exercise_variety') AND tier_level = 1;
UPDATE achievement_tiers SET threshold_value = 15
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'exercise_variety') AND tier_level = 2;
UPDATE achievement_tiers SET threshold_value = 40
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'exercise_variety') AND tier_level = 3;
UPDATE achievement_tiers SET threshold_value = 100
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'exercise_variety') AND tier_level = 4;
UPDATE achievement_tiers SET threshold_value = 200
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = 'exercise_variety') AND tier_level = 5;


-- 4. Recreate RPCs with new active_weeks metric

CREATE OR REPLACE FUNCTION check_and_grant_achievements(p_user_id uuid)
RETURNS TABLE (
  tier_id uuid, group_slug text, rank text,
  title_en text, title_fr text, icon_asset_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'access denied: cannot grant achievements for another user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH user_sessions AS (
    SELECT s.id, s.workout_day_id, s.finished_at
    FROM sessions s
    WHERE s.user_id = p_user_id AND s.finished_at IS NOT NULL
  ),
  metrics AS (
    SELECT 'session_count' AS metric_type, COUNT(*)::numeric AS value
      FROM user_sessions

    UNION ALL

    SELECT 'total_volume_kg',
           COALESCE(SUM(sl.weight_logged * sl.reps_logged::int), 0)
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      WHERE sl.reps_logged IS NOT NULL
        AND sl.reps_logged ~ '^\d+$'

    UNION ALL

    SELECT 'pr_count', COUNT(*)::numeric
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      WHERE sl.was_pr = true

    UNION ALL

    SELECT 'unique_exercises', COUNT(DISTINCT sl.exercise_id)::numeric
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id

    UNION ALL

    SELECT 'active_weeks', COUNT(*)::numeric
      FROM (
        SELECT date_trunc('week', us.finished_at) AS wk
        FROM user_sessions us
        GROUP BY date_trunc('week', us.finished_at)
        HAVING COUNT(*) >= 3
      ) AS weeks_with_3plus
  ),
  eligible AS (
    SELECT at.id, ag.slug, at.rank AS r,
           at.title_en, at.title_fr, at.icon_asset_url
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


CREATE OR REPLACE FUNCTION get_badge_status(p_user_id uuid)
RETURNS TABLE (
  group_id uuid, group_slug text, group_name_en text, group_name_fr text,
  tier_id uuid, tier_level int, rank text,
  title_en text, title_fr text,
  threshold_value numeric, icon_asset_url text,
  is_unlocked boolean, granted_at timestamptz,
  current_value numeric, progress_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'access denied: cannot read badge status for another user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH user_sessions AS (
    SELECT s.id, s.workout_day_id, s.finished_at
    FROM sessions s
    WHERE s.user_id = p_user_id AND s.finished_at IS NOT NULL
  ),
  metrics AS (
    SELECT 'session_count' AS metric_type, COUNT(*)::numeric AS value
      FROM user_sessions

    UNION ALL

    SELECT 'total_volume_kg',
           COALESCE(SUM(sl.weight_logged * sl.reps_logged::int), 0)
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      WHERE sl.reps_logged IS NOT NULL
        AND sl.reps_logged ~ '^\d+$'

    UNION ALL

    SELECT 'pr_count', COUNT(*)::numeric
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      WHERE sl.was_pr = true

    UNION ALL

    SELECT 'unique_exercises', COUNT(DISTINCT sl.exercise_id)::numeric
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id

    UNION ALL

    SELECT 'active_weeks', COUNT(*)::numeric
      FROM (
        SELECT date_trunc('week', us.finished_at) AS wk
        FROM user_sessions us
        GROUP BY date_trunc('week', us.finished_at)
        HAVING COUNT(*) >= 3
      ) AS weeks_with_3plus
  )
  SELECT
    ag.id, ag.slug, ag.name_en, ag.name_fr,
    at.id, at.tier_level, at.rank,
    at.title_en, at.title_fr,
    at.threshold_value, at.icon_asset_url,
    (ua.id IS NOT NULL), ua.granted_at,
    COALESCE(m.value, 0),
    LEAST(COALESCE(m.value, 0) / NULLIF(at.threshold_value, 0) * 100, 100)
  FROM achievement_groups ag
  JOIN achievement_tiers at ON at.group_id = ag.id
  LEFT JOIN user_achievements ua ON ua.tier_id = at.id AND ua.user_id = p_user_id
  LEFT JOIN metrics m ON m.metric_type = ag.metric_type
  ORDER BY ag.sort_order, at.tier_level;
END;
$$;
