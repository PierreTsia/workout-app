-- Broaden quick_sessions metric: count sessions from single-day programs
-- (no template) or programless workout_days.
--
-- A "quick session" = session whose workout_day either:
--   1. has no program (program_id IS NULL — QuickWorkoutSheet flow), OR
--   2. belongs to a template-less, single-day program (one-off workouts
--      the user builds ad-hoc like "Biceps triceps", "Home quick", etc.)
--
-- Multi-day template-less programs (e.g. "Push Pull 3x") are excluded
-- because the user intentionally structured them as real programs.
--
-- Applied to both check_and_grant_achievements and get_badge_status.

-- ── check_and_grant_achievements ────────────────────────────────────

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

    UNION ALL
    SELECT 'quick_sessions', COUNT(*)::numeric
      FROM user_sessions us
      LEFT JOIN workout_days wd ON wd.id = us.workout_day_id
      LEFT JOIN programs p ON p.id = wd.program_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS day_count
        FROM workout_days wd2
        WHERE wd2.program_id = p.id
      ) dc ON true
      WHERE wd.program_id IS NULL
         OR (p.template_id IS NULL AND dc.day_count = 1)

    UNION ALL
    SELECT 'leg_day', COUNT(*)::numeric
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      JOIN exercises e ON e.id = sl.exercise_id
      WHERE e.muscle_group IN ('Quadriceps', 'Ischios', 'Fessiers', 'Adducteurs', 'Mollets')

    UNION ALL
    SELECT 'streak_king', COALESCE(MAX(streak_len), 0)::numeric
      FROM (
        SELECT COUNT(*) AS streak_len
        FROM (
          SELECT wk,
                 wk - (ROW_NUMBER() OVER (ORDER BY wk))::bigint AS grp
          FROM (
            SELECT DISTINCT
              (EXTRACT(EPOCH FROM date_trunc('week', us.finished_at))::bigint / 604800) AS wk
            FROM user_sessions us
          ) distinct_weeks
        ) grouped
        GROUP BY grp
      ) streaks

    UNION ALL
    SELECT 'marathoner', COUNT(*)::numeric
      FROM (
        SELECT us.id
        FROM set_logs sl
        JOIN user_sessions us ON us.id = sl.session_id
        WHERE sl.reps_logged IS NOT NULL
          AND sl.reps_logged ~ '^\d+$'
        GROUP BY us.id
        HAVING SUM(sl.weight_logged * sl.reps_logged::int) >= 5000
      ) heavy_sessions

    UNION ALL
    SELECT 'pr_streak', COALESCE(MAX(streak_len), 0)::numeric
      FROM (
        SELECT COUNT(*) AS streak_len
        FROM (
          SELECT session_ord,
                 session_ord - ROW_NUMBER() OVER (ORDER BY session_ord) AS grp
          FROM (
            SELECT us.id,
                   ROW_NUMBER() OVER (ORDER BY us.finished_at, us.id) AS session_ord,
                   (prs.session_id IS NOT NULL) AS has_pr
            FROM user_sessions us
            LEFT JOIN (
              SELECT DISTINCT sl.session_id
              FROM set_logs sl
              WHERE sl.was_pr = true
            ) prs ON prs.session_id = us.id
          ) all_sessions
          WHERE has_pr
        ) grouped
        GROUP BY grp
      ) streaks

    UNION ALL
    SELECT 'early_bird', COUNT(*)::numeric
      FROM user_sessions us
      LEFT JOIN user_profiles up ON up.user_id = p_user_id
      WHERE EXTRACT(HOUR FROM us.finished_at AT TIME ZONE COALESCE(up.timezone, 'UTC')) < 8
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


-- ── get_badge_status ────────────────────────────────────────────────

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

    UNION ALL
    SELECT 'quick_sessions', COUNT(*)::numeric
      FROM user_sessions us
      LEFT JOIN workout_days wd ON wd.id = us.workout_day_id
      LEFT JOIN programs p ON p.id = wd.program_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS day_count
        FROM workout_days wd2
        WHERE wd2.program_id = p.id
      ) dc ON true
      WHERE wd.program_id IS NULL
         OR (p.template_id IS NULL AND dc.day_count = 1)

    UNION ALL
    SELECT 'leg_day', COUNT(*)::numeric
      FROM set_logs sl
      JOIN user_sessions us ON us.id = sl.session_id
      JOIN exercises e ON e.id = sl.exercise_id
      WHERE e.muscle_group IN ('Quadriceps', 'Ischios', 'Fessiers', 'Adducteurs', 'Mollets')

    UNION ALL
    SELECT 'streak_king', COALESCE(MAX(streak_len), 0)::numeric
      FROM (
        SELECT COUNT(*) AS streak_len
        FROM (
          SELECT wk,
                 wk - (ROW_NUMBER() OVER (ORDER BY wk))::bigint AS grp
          FROM (
            SELECT DISTINCT
              (EXTRACT(EPOCH FROM date_trunc('week', us.finished_at))::bigint / 604800) AS wk
            FROM user_sessions us
          ) distinct_weeks
        ) grouped
        GROUP BY grp
      ) streaks

    UNION ALL
    SELECT 'marathoner', COUNT(*)::numeric
      FROM (
        SELECT us.id
        FROM set_logs sl
        JOIN user_sessions us ON us.id = sl.session_id
        WHERE sl.reps_logged IS NOT NULL
          AND sl.reps_logged ~ '^\d+$'
        GROUP BY us.id
        HAVING SUM(sl.weight_logged * sl.reps_logged::int) >= 5000
      ) heavy_sessions

    UNION ALL
    SELECT 'pr_streak', COALESCE(MAX(streak_len), 0)::numeric
      FROM (
        SELECT COUNT(*) AS streak_len
        FROM (
          SELECT session_ord,
                 session_ord - ROW_NUMBER() OVER (ORDER BY session_ord) AS grp
          FROM (
            SELECT us.id,
                   ROW_NUMBER() OVER (ORDER BY us.finished_at, us.id) AS session_ord,
                   (prs.session_id IS NOT NULL) AS has_pr
            FROM user_sessions us
            LEFT JOIN (
              SELECT DISTINCT sl.session_id
              FROM set_logs sl
              WHERE sl.was_pr = true
            ) prs ON prs.session_id = us.id
          ) all_sessions
          WHERE has_pr
        ) grouped
        GROUP BY grp
      ) streaks

    UNION ALL
    SELECT 'early_bird', COUNT(*)::numeric
      FROM user_sessions us
      LEFT JOIN user_profiles up ON up.user_id = p_user_id
      WHERE EXTRACT(HOUR FROM us.finished_at AT TIME ZONE COALESCE(up.timezone, 'UTC')) < 8
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
