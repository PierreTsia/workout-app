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
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      WHERE sl.reps_logged IS NOT NULL

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

GRANT EXECUTE ON FUNCTION check_and_grant_achievements(uuid) TO authenticated;
