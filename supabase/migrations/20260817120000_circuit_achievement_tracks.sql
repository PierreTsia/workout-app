-- =============================================================
-- Circuit Achievement Tracks (#482 / T209)
-- 5 new groups (circuit_runner, spidey, olympians, heroes,
-- pantheoniste) with 25 tiers (sort_order 12–16).
-- Replaces both achievement RPCs with shared qualifying_runs CTE
-- + 5 metric branches (16 total). Auth guards unchanged.
-- =============================================================

-- 1. Seed new achievement groups
INSERT INTO achievement_groups (slug, name_fr, name_en, description_fr, description_en, metric_type, sort_order)
VALUES
  ('circuit_runner', 'Circuit runner',        'Circuit Runner',  'Runs de circuits GymLogic (1+ tour)',              'GymLogic circuit runs (1+ round)',                         'circuit_runner', 12),
  ('spidey',         'L''Araignée',            'Spidey',          'Meilleur score Cindy en tours',                   'Best Cindy score in rounds',                               'spidey',         13),
  ('olympians',      'Au sommet de l''Olympe', 'Olympus Summit',  'Min. de runs Zeus / Arès / Athéna / Hadès',       'Min. runs across Zeus / Ares / Athena / Hades',            'olympians',      14),
  ('heroes',         'Le tour des Héros',      'Heroes'' Tour',   'Min. de runs Héraclès / Thésée / Atlas / Achille','Min. runs across Heracles / Theseus / Atlas / Achilles',   'heroes',         15),
  ('pantheoniste',   'Le Pantheoniste',        'Pantheoniste',    'Min. de runs sur les huit grecs',                 'Min. runs across the eight Greek seeds',                   'pantheoniste',   16);

-- 2. Seed new achievement tiers (5 ranks × 5 groups = 25). icon_asset_url NULL.

-- Circuit runner
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'circuit_runner')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Premier tour',       'First Lap',       1),
  ((SELECT id FROM g), 2, 'silver',   'En rythme',          'In Cadence',      5),
  ((SELECT id FROM g), 3, 'gold',     'Sans relâche',       'No Break',        15),
  ((SELECT id FROM g), 4, 'platinum', 'Workout machine',    'Workout Machine', 40),
  ((SELECT id FROM g), 5, 'diamond',  'Star des circuits',  'Circuit Star',    100);

-- Spidey (L'Araignée) — full rounds only; diamond = Holland 27
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'spidey')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Baby Spidey',              'Baby Spidey',       1),
  ((SELECT id FROM g), 2, 'silver',   'Side-kick',                'Sidekick',          10),
  ((SELECT id FROM g), 3, 'gold',     'Araignée du quotidien',    'Everyday Spidey',   18),
  ((SELECT id FROM g), 4, 'platinum', 'Au bord du 27',            'Edge of 27',        23),
  ((SELECT id FROM g), 5, 'diamond',  'À la table de Holland',    'Holland''s Table',  27);

-- Olympians (Au sommet de l'Olympe)
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'olympians')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Selfie avec Zeus',   'Zeus Selfie',     1),
  ((SELECT id FROM g), 2, 'silver',   'Nectar gratis',      'Free Nectar',     5),
  ((SELECT id FROM g), 3, 'gold',     'Banquet divin',      'Divine Banquet',  10),
  ((SELECT id FROM g), 4, 'platinum', 'VIP Olympe',         'Olympus VIP',     50),
  ((SELECT id FROM g), 5, 'diamond',  'PDG de l''Olympe',   'Olympus CEO',     100);

-- Heroes (Le tour des Héros)
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'heroes')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Stage chez Héraclès',       'Intern for Heracles',      1),
  ((SELECT id FROM g), 2, 'silver',   'GPS de Thésée',             'Theseus GPS',              5),
  ((SELECT id FROM g), 3, 'gold',     'Atlas porte tes courses',   'Atlas Holds Your Bags',    10),
  ((SELECT id FROM g), 4, 'platinum', 'Achille sans talon',        'Achilles, No Heel',        50),
  ((SELECT id FROM g), 5, 'diamond',  'DRH des héros',             'Heroes'' HR',              100);

-- Pantheoniste
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'pantheoniste')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Badge d''entrée',              'Pantheon Guest Pass',   1),
  ((SELECT id FROM g), 2, 'silver',   'Collectionneur de statues',    'Statue Collector',      5),
  ((SELECT id FROM g), 3, 'gold',     'Guide du musée grec',          'Greek Museum Guide',    10),
  ((SELECT id FROM g), 4, 'platinum', 'Conservateur du temple',       'Temple Curator',        50),
  ((SELECT id FROM g), 5, 'diamond',  'Le 9e du Panthéon',            'Ninth of the Pantheon', 100);


-- 3. Replace check_and_grant_achievements
-- Body from 20260802170000_secure_definer_rpcs.sql + qualifying_runs + 5 branches.

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
  IF NOT (
    COALESCE(auth.uid() = p_user_id, false)
    OR is_trusted_backend_caller()
  ) THEN
    RAISE EXCEPTION 'access denied: cannot grant achievements for another user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH user_sessions AS (
    SELECT s.id, s.workout_day_id, s.finished_at
    FROM sessions s
    WHERE s.user_id = p_user_id AND s.finished_at IS NOT NULL
  ),
  -- Circuit Achievement Run: GO snapshot FK → seed (owner_id IS NULL),
  -- finished_at set, full_rounds = MAX(set_number)-1 >= 1 (amrapScore oracle).
  qualifying_runs AS (
    SELECT br.id, br.session_id, bc.slug,
           (MAX(sl.set_number) - 1) AS full_rounds
    FROM block_runs br
    JOIN sessions s ON s.id = br.session_id AND s.user_id = p_user_id
    JOIN benchmark_circuits bc ON bc.id = br.benchmark_circuit_id
      AND bc.owner_id IS NULL
    JOIN block_exercises be ON be.block_id = br.block_id
    JOIN set_logs sl ON sl.session_id = br.session_id
      AND sl.block_exercise_id = be.id
    WHERE br.finished_at IS NOT NULL
    GROUP BY br.id, br.session_id, bc.slug
    HAVING (MAX(sl.set_number) - 1) >= 1
  ),
  olympian_slugs AS (
    SELECT unnest(ARRAY['zeus','ares','athena','hades']) AS slug
  ),
  hero_slugs AS (
    SELECT unnest(ARRAY['heracles','theseus','atlas','achilles']) AS slug
  ),
  pantheon_slugs AS (
    SELECT slug FROM olympian_slugs
    UNION ALL
    SELECT slug FROM hero_slugs
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
      WHERE EXTRACT(HOUR FROM us.finished_at AT TIME ZONE COALESCE(up.timezone, 'UTC')) BETWEEN 5 AND 7

    -- === CIRCUIT TRACKS (#482) ===

    UNION ALL
    SELECT 'circuit_runner', COUNT(*)::numeric
      FROM qualifying_runs

    UNION ALL
    SELECT 'spidey', COALESCE(MAX(full_rounds), 0)::numeric
      FROM qualifying_runs
      WHERE slug = 'cindy'

    -- Cast Clearing: LEFT JOIN fixed slug lists so a missing seed (e.g. Hades)
    -- yields cnt 0; MIN stays 0. Never MIN over observed-only rows.
    UNION ALL
    SELECT 'olympians', COALESCE(MIN(c.cnt), 0)::numeric
      FROM (
        SELECT COALESCE(COUNT(q.id), 0) AS cnt
        FROM olympian_slugs o
        LEFT JOIN qualifying_runs q ON q.slug = o.slug
        GROUP BY o.slug
      ) c

    UNION ALL
    SELECT 'heroes', COALESCE(MIN(c.cnt), 0)::numeric
      FROM (
        SELECT COALESCE(COUNT(q.id), 0) AS cnt
        FROM hero_slugs h
        LEFT JOIN qualifying_runs q ON q.slug = h.slug
        GROUP BY h.slug
      ) c

    UNION ALL
    SELECT 'pantheoniste', COALESCE(MIN(c.cnt), 0)::numeric
      FROM (
        SELECT COALESCE(COUNT(q.id), 0) AS cnt
        FROM pantheon_slugs p
        LEFT JOIN qualifying_runs q ON q.slug = p.slug
        GROUP BY p.slug
      ) c
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


-- 4. Replace get_badge_status (identical qualifying_runs + metrics CTE)

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
  IF NOT (
    COALESCE(auth.uid() = p_user_id, false)
    OR is_trusted_backend_caller()
  ) THEN
    RAISE EXCEPTION 'access denied: cannot read badge status for another user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH user_sessions AS (
    SELECT s.id, s.workout_day_id, s.finished_at
    FROM sessions s
    WHERE s.user_id = p_user_id AND s.finished_at IS NOT NULL
  ),
  -- Circuit Achievement Run: GO snapshot FK → seed (owner_id IS NULL),
  -- finished_at set, full_rounds = MAX(set_number)-1 >= 1 (amrapScore oracle).
  qualifying_runs AS (
    SELECT br.id, br.session_id, bc.slug,
           (MAX(sl.set_number) - 1) AS full_rounds
    FROM block_runs br
    JOIN sessions s ON s.id = br.session_id AND s.user_id = p_user_id
    JOIN benchmark_circuits bc ON bc.id = br.benchmark_circuit_id
      AND bc.owner_id IS NULL
    JOIN block_exercises be ON be.block_id = br.block_id
    JOIN set_logs sl ON sl.session_id = br.session_id
      AND sl.block_exercise_id = be.id
    WHERE br.finished_at IS NOT NULL
    GROUP BY br.id, br.session_id, bc.slug
    HAVING (MAX(sl.set_number) - 1) >= 1
  ),
  olympian_slugs AS (
    SELECT unnest(ARRAY['zeus','ares','athena','hades']) AS slug
  ),
  hero_slugs AS (
    SELECT unnest(ARRAY['heracles','theseus','atlas','achilles']) AS slug
  ),
  pantheon_slugs AS (
    SELECT slug FROM olympian_slugs
    UNION ALL
    SELECT slug FROM hero_slugs
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
      WHERE EXTRACT(HOUR FROM us.finished_at AT TIME ZONE COALESCE(up.timezone, 'UTC')) BETWEEN 5 AND 7

    -- === CIRCUIT TRACKS (#482) ===

    UNION ALL
    SELECT 'circuit_runner', COUNT(*)::numeric
      FROM qualifying_runs

    UNION ALL
    SELECT 'spidey', COALESCE(MAX(full_rounds), 0)::numeric
      FROM qualifying_runs
      WHERE slug = 'cindy'

    -- Cast Clearing: LEFT JOIN fixed slug lists so a missing seed (e.g. Hades)
    -- yields cnt 0; MIN stays 0. Never MIN over observed-only rows.
    UNION ALL
    SELECT 'olympians', COALESCE(MIN(c.cnt), 0)::numeric
      FROM (
        SELECT COALESCE(COUNT(q.id), 0) AS cnt
        FROM olympian_slugs o
        LEFT JOIN qualifying_runs q ON q.slug = o.slug
        GROUP BY o.slug
      ) c

    UNION ALL
    SELECT 'heroes', COALESCE(MIN(c.cnt), 0)::numeric
      FROM (
        SELECT COALESCE(COUNT(q.id), 0) AS cnt
        FROM hero_slugs h
        LEFT JOIN qualifying_runs q ON q.slug = h.slug
        GROUP BY h.slug
      ) c

    UNION ALL
    SELECT 'pantheoniste', COALESCE(MIN(c.cnt), 0)::numeric
      FROM (
        SELECT COALESCE(COUNT(q.id), 0) AS cnt
        FROM pantheon_slugs p
        LEFT JOIN qualifying_runs q ON q.slug = p.slug
        GROUP BY p.slug
      ) c
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
