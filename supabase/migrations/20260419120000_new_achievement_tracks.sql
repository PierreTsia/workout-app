-- =============================================================
-- New Achievement Tracks (#218)
-- 6 new groups (quick_sessions, leg_day, streak_king,
-- marathoner, pr_streak, early_bird) with 30 tiers.
-- Adds timezone column to user_profiles for Early Bird.
-- Replaces both RPCs with expanded metrics CTE (11 branches).
-- =============================================================

-- 1. Timezone column + backfill
ALTER TABLE user_profiles ADD COLUMN timezone text DEFAULT 'Europe/Paris';
UPDATE user_profiles SET timezone = 'Europe/Paris' WHERE timezone IS NULL;

-- 2. Seed new achievement groups
INSERT INTO achievement_groups (slug, name_fr, name_en, description_fr, description_en, metric_type, sort_order)
VALUES
  ('quick_sessions', 'Quick & Dirty',   'Quick & Dirty',   'Séances rapides (sans programme)',               'Quick sessions (no program)',                    'quick_sessions',  6),
  ('leg_day',        'Leg Day',          'Leg Day',         'Séries ciblant les jambes (5 groupes)',           'Sets targeting leg muscles (5 groups)',           'leg_day',         7),
  ('streak_king',    'Streak King',      'Streak King',     'Plus longue série de semaines consécutives',     'Longest streak of consecutive weeks',            'streak_king',     8),
  ('marathoner',     'Le Marathonien',   'The Marathoner',  'Séances avec un volume total ≥ 5 000 kg',       'Sessions with total volume ≥ 5,000 kg',          'marathoner',      9),
  ('pr_streak',      'Série de Records', 'PR Streak',       'Plus longue série de séances avec au moins 1 PR','Longest streak of sessions with at least 1 PR',  'pr_streak',       10),
  ('early_bird',     'Early Bird',       'Early Bird',      'Séances terminées avant 8h',                     'Sessions finished before 8 AM',                  'early_bird',      11);

-- 3. Seed new achievement tiers (5 ranks × 6 groups = 30)

-- Quick & Dirty
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'quick_sessions')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Pas d''excuse',       'No Excuses',          5),
  ((SELECT id FROM g), 2, 'silver',   'Franc-tireur',        'Lone Wolf',           20),
  ((SELECT id FROM g), 3, 'gold',     'Électron libre',      'Free Radical',        60),
  ((SELECT id FROM g), 4, 'platinum', 'Hors Programme',      'Off Script',          150),
  ((SELECT id FROM g), 5, 'diamond',  'L''Incontrôlable',    'The Uncontrollable',  400);

-- Leg Day Survivor
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'leg_day')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Rescapé du squat',    'Squat Survivor',      50),
  ((SELECT id FROM g), 2, 'silver',   'Anti-chicken legs',   'Anti-Chicken Legs',   200),
  ((SELECT id FROM g), 3, 'gold',     'Roi du Rack',         'Rack Royalty',        500),
  ((SELECT id FROM g), 4, 'platinum', 'Pilier de fonte',     'Iron Pillar',         1200),
  ((SELECT id FROM g), 5, 'diamond',  'Titan des cuisses',   'Thigh Titan',         3000);

-- Streak King
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'streak_king')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Trois de suite',      'Three in a Row',      3),
  ((SELECT id FROM g), 2, 'silver',   'Deux mois d''acier',  'Steel Streak',        8),
  ((SELECT id FROM g), 3, 'gold',     'Trimestre de fer',    'Iron Quarter',        12),
  ((SELECT id FROM g), 4, 'platinum', 'Inarrêtable',         'Unstoppable',         26),
  ((SELECT id FROM g), 5, 'diamond',  'La Chaîne Éternelle', 'The Eternal Chain',   52);

-- Le Marathonien
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'marathoner')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Séance lourde',       'Heavy Hitter',        5),
  ((SELECT id FROM g), 2, 'silver',   'Tonnage garanti',     'Tonnage Guaranteed',  20),
  ((SELECT id FROM g), 3, 'gold',     'Broyeur de barres',   'Bar Crusher',         60),
  ((SELECT id FROM g), 4, 'platinum', 'Usine à volume',      'Volume Factory',      150),
  ((SELECT id FROM g), 5, 'diamond',  'Le Marathonien',      'The Marathoner',      400);

-- La Série Ininterrompue (PR Streak)
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'pr_streak')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Trois d''affilée',    'Flash Fire',          3),
  ((SELECT id FROM g), 2, 'silver',   'En feu',              'On Fire',             5),
  ((SELECT id FROM g), 3, 'gold',     'Enchaînement parfait','Perfect Run',         10),
  ((SELECT id FROM g), 4, 'platinum', 'Fléau des plateaux',  'Plateau Slayer',      20),
  ((SELECT id FROM g), 5, 'diamond',  'Le Phénomène',        'The Phenomenon',      40);

-- Early Bird
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'early_bird')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Lève-tôt',                    'Early Riser',              5),
  ((SELECT id FROM g), 2, 'silver',   'Coq du matin',                'Morning Rooster',          20),
  ((SELECT id FROM g), 3, 'gold',     'Guerrier de l''aube',         'Dawn Warrior',             60),
  ((SELECT id FROM g), 4, 'platinum', 'Premier au rack',             'First at the Rack',        150),
  ((SELECT id FROM g), 5, 'diamond',  'Le Soleil se lève pour toi',  'The Sun Rises for You',    400);


-- 4. Replace check_and_grant_achievements with 11-branch metrics CTE

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
    -- === EXISTING TRACKS ===
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

    -- === NEW TRACKS (#218) ===

    UNION ALL
    SELECT 'quick_sessions', COUNT(*)::numeric
      FROM user_sessions us
      WHERE us.workout_day_id IS NULL

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
                   ROW_NUMBER() OVER (ORDER BY us.finished_at) AS session_ord,
                   EXISTS (
                     SELECT 1 FROM set_logs sl
                     WHERE sl.session_id = us.id AND sl.was_pr = true
                   ) AS has_pr
            FROM user_sessions us
          ) all_sessions
          WHERE has_pr
        ) grouped
        GROUP BY grp
      ) streaks

    UNION ALL
    SELECT 'early_bird', COUNT(*)::numeric
      FROM user_sessions us
      JOIN user_profiles up ON up.user_id = p_user_id
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


-- 5. Replace get_badge_status with 11-branch metrics CTE

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
    -- === EXISTING TRACKS ===
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

    -- === NEW TRACKS (#218) ===

    UNION ALL
    SELECT 'quick_sessions', COUNT(*)::numeric
      FROM user_sessions us
      WHERE us.workout_day_id IS NULL

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
                   ROW_NUMBER() OVER (ORDER BY us.finished_at) AS session_ord,
                   EXISTS (
                     SELECT 1 FROM set_logs sl
                     WHERE sl.session_id = us.id AND sl.was_pr = true
                   ) AS has_pr
            FROM user_sessions us
          ) all_sessions
          WHERE has_pr
        ) grouped
        GROUP BY grp
      ) streaks

    UNION ALL
    SELECT 'early_bird', COUNT(*)::numeric
      FROM user_sessions us
      JOIN user_profiles up ON up.user_id = p_user_id
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
