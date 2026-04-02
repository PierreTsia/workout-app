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

GRANT EXECUTE ON FUNCTION get_badge_status(uuid) TO authenticated;
