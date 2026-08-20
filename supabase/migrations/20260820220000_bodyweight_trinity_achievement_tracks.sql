-- =============================================================
-- Bodyweight Trinity Achievement Tracks (#509 / T220)
-- 5 new groups (push_ups, pull_ups, bw_squats, bw_expert,
-- hundred_a_day) with 25 tiers (sort_order 17–21).
-- Replaces both achievement RPCs with family UUID CTEs + 5 metric
-- branches (21 total). Auth guards unchanged. No DROP.
-- Family lists are Bodyweight Trinity (not a catalog column).
-- hundred_a_day is live chain, not MAX(streak_len).
-- Circuit set_logs count 1:1 (no block_exercise_id filter).
-- =============================================================

-- 1. Seed new achievement groups
INSERT INTO achievement_groups (slug, name_fr, name_en, description_fr, description_en, metric_type, sort_order)
VALUES
  ('push_ups',      'Pompes',                    'Push-ups',            'Reps cumulées de la famille Pompes',                         'Cumulative Pompes-family reps',                              'push_ups',      17),
  ('pull_ups',      'Tractions',                  'Pull-ups',            'Reps cumulées de la famille Tractions',                      'Cumulative Tractions-family reps',                           'pull_ups',      18),
  ('bw_squats',     'Squat poids du corps',       'Bodyweight Squat',    'Reps cumulées de la famille Squat PDC',                      'Cumulative bodyweight-squat family reps',                    'bw_squats',     19),
  ('bw_expert',     'Expert du poids du corps',   'Bodyweight Expert',   'Min. des trois familles',                                    'Min. of the three family totals',                            'bw_expert',     20),
  ('hundred_a_day', '100 jours ferme',            'Hard Time',           'Jours d''affilée en cours avec ≥100 pompes (famille)',       'Current consecutive days with ≥100 Pompes-family reps',      'hundred_a_day', 21);

-- 2. Seed new achievement tiers (5 ranks × 5 groups = 25). icon_asset_url NULL.

-- Pompes
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'push_ups')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Nez au sol',          'Nose to Floor',       100),
  ((SELECT id FROM g), 2, 'silver',   'Piston',              'Piston',              500),
  ((SELECT id FROM g), 3, 'gold',     'Mur de pompes',       'Push-up Wall',        2500),
  ((SELECT id FROM g), 4, 'platinum', 'Le Vérin',            'The Jack',            10000),
  ((SELECT id FROM g), 5, 'diamond',  'La Pompe éternelle',  'The Eternal Pump',    25000);

-- Tractions
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'pull_ups')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Menton à la barre',   'Chin Over',           100),
  ((SELECT id FROM g), 2, 'silver',   'Dos en V',            'V-Taper',             500),
  ((SELECT id FROM g), 3, 'gold',     'Grand dorsal',        'The Lats',            2500),
  ((SELECT id FROM g), 4, 'platinum', 'Tractionnaire',       'Bar Addict',          10000),
  ((SELECT id FROM g), 5, 'diamond',  'Le Roi de la barre',  'King of the Bar',     25000);

-- Squat poids du corps
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'bw_squats')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Cul vers l''herbe',   'Ass to Grass',        100),
  ((SELECT id FROM g), 2, 'silver',   'Genoux souples',      'Soft Knees',          500),
  ((SELECT id FROM g), 3, 'gold',     'Le Puits',            'The Well',            2500),
  ((SELECT id FROM g), 4, 'platinum', 'Sans barre',          'No Bar',              10000),
  ((SELECT id FROM g), 5, 'diamond',  'Le Puits éternel',    'The Eternal Well',    25000);

-- Expert du poids du corps
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'bw_expert')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Le Trio',                    'The Trio',           100),
  ((SELECT id FROM g), 2, 'silver',   'Équilibriste',               'Tightrope',          500),
  ((SELECT id FROM g), 3, 'gold',     'Sans machine',               'No Machine',         2500),
  ((SELECT id FROM g), 4, 'platinum', 'Calisthéniste',              'Calisthenist',       10000),
  ((SELECT id FROM g), 5, 'diamond',  'Expert du poids du corps',   'Bodyweight Expert',  25000);

-- 100 jours ferme
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'hundred_a_day')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Garde à vue',         'In Custody',          1),
  ((SELECT id FROM g), 2, 'silver',   'Préventive',          'On Remand',           10),
  ((SELECT id FROM g), 3, 'gold',     'Un mois ferme',       'A Month Inside',      30),
  ((SELECT id FROM g), 4, 'platinum', 'Mitard',              'The Hole',            60),
  ((SELECT id FROM g), 5, 'diamond',  '100 jours ferme',     'Hard Time',           100);


-- 3. Replace check_and_grant_achievements
-- Body from 20260819174900_grant_achievements_threshold_value.sql + family CTEs + 5 branches.
-- No DROP — RETURNS TABLE is unchanged (threshold_value already present).

CREATE OR REPLACE FUNCTION check_and_grant_achievements(p_user_id uuid)
RETURNS TABLE (
  tier_id uuid, group_slug text, rank text,
  title_en text, title_fr text, icon_asset_url text,
  threshold_value numeric
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
  -- Bodyweight Trinity families (hardcoded catalog UUIDs, not a movement_family column).
  -- Circuit station set_logs count 1:1 — no block_exercise_id IS NULL filter.
  push_up_ids AS (
    SELECT unnest(ARRAY[
      'e63fe427-e910-4e0d-9f73-c51d85b36a3f',
      '5c7e172f-6c33-46cc-9886-4c31287623a8',
      'de827afb-d91b-400a-bd5f-415beca277df',
      '4a1a7219-bd91-4d59-9d73-2c30c5d9f0ce',
      '92d8460a-b5c6-449a-9659-004a7ee9565c',
      '01babef5-3139-4f37-b23f-88ef8d40279d',
      '426a5c8a-60bd-456c-b5c9-9bf92913f089',
      '6b46d77b-1291-44b9-9d40-f4da8930ae17'
    ]::uuid[]) AS exercise_id
  ),
  pull_up_ids AS (
    SELECT unnest(ARRAY[
      '261dca1e-9bae-4098-8676-6169597f9964',
      '00731099-9e50-4c90-a92e-0b4433881125',
      '5c0d0e9c-2118-4be4-a90b-31239029b7a3',
      '3ce11aeb-966e-4168-b744-902b7d357cfe',
      '366e1372-4fa0-40c4-816c-6fa83aa2c53d',
      'a3de462c-9cb9-4a59-ae31-11fbb842895b'
    ]::uuid[]) AS exercise_id
  ),
  bw_squat_ids AS (
    SELECT unnest(ARRAY[
      '41de0558-c044-4f90-b112-2b09c16e985c',
      'f1c88f28-8742-4862-985d-0752deca3675',
      '24e5654d-8414-4df6-b928-d2a4f6974d22',
      '473523ed-8ef9-493e-8e33-660de7979a7a',
      '113d352b-5f40-46ad-9d43-a1f5c9f33934',
      '4abd9a5f-78ed-4772-bf3d-153cccc7cb65'
    ]::uuid[]) AS exercise_id
  ),
  user_tz AS (
    SELECT COALESCE(
      (SELECT timezone FROM user_profiles WHERE user_id = p_user_id),
      'UTC'
    ) AS tz
  ),
  family_rep_totals AS (
    SELECT
      COALESCE(SUM(sl.reps_logged::int) FILTER (
        WHERE sl.exercise_id IN (SELECT exercise_id FROM push_up_ids)
      ), 0) AS push_ups,
      COALESCE(SUM(sl.reps_logged::int) FILTER (
        WHERE sl.exercise_id IN (SELECT exercise_id FROM pull_up_ids)
      ), 0) AS pull_ups,
      COALESCE(SUM(sl.reps_logged::int) FILTER (
        WHERE sl.exercise_id IN (SELECT exercise_id FROM bw_squat_ids)
      ), 0) AS bw_squats
    FROM set_logs sl
    JOIN user_sessions us ON us.id = sl.session_id
    WHERE sl.reps_logged IS NOT NULL
      AND sl.reps_logged ~ '^\d+$'
  ),
  qualifying_push_days AS (
    SELECT (sl.logged_at AT TIME ZONE (SELECT tz FROM user_tz))::date AS local_day
    FROM set_logs sl
    JOIN user_sessions us ON us.id = sl.session_id
    WHERE sl.exercise_id IN (SELECT exercise_id FROM push_up_ids)
      AND sl.reps_logged IS NOT NULL
      AND sl.reps_logged ~ '^\d+$'
      AND sl.logged_at IS NOT NULL
    GROUP BY 1
    HAVING SUM(sl.reps_logged::int) >= 100
  ),
  push_streaks AS (
    SELECT grp, COUNT(*)::int AS streak_len, MAX(local_day) AS end_day
    FROM (
      SELECT local_day,
             local_day - (ROW_NUMBER() OVER (ORDER BY local_day))::int AS grp
      FROM qualifying_push_days
    ) islands
    GROUP BY grp
  ),
  -- hundred_a_day is the live chain (today/yesterday grace), not MAX(streak_len).
  hundred_a_day_current AS (
    SELECT COALESCE(
      (
        SELECT s.streak_len
        FROM push_streaks s
        CROSS JOIN user_tz t
        WHERE s.end_day BETWEEN
          (now() AT TIME ZONE t.tz)::date - 1
          AND (now() AT TIME ZONE t.tz)::date
        ORDER BY s.end_day DESC
        LIMIT 1
      ),
      0
    )::numeric AS value
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
      WHERE us.workout_day_id IS NOT NULL
        AND (
          wd.program_id IS NULL
          OR (p.template_id IS NULL AND dc.day_count = 1)
        )

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

    -- === BODYWEIGHT TRINITY (#509) ===

    UNION ALL
    SELECT 'push_ups', push_ups::numeric FROM family_rep_totals
    UNION ALL
    SELECT 'pull_ups', pull_ups::numeric FROM family_rep_totals
    UNION ALL
    SELECT 'bw_squats', bw_squats::numeric FROM family_rep_totals
    UNION ALL
    SELECT 'bw_expert',
           LEAST(push_ups, pull_ups, bw_squats)::numeric
      FROM family_rep_totals
    UNION ALL
    SELECT 'hundred_a_day', value FROM hundred_a_day_current

  ),
  eligible AS (
    SELECT at.id, ag.slug, at.rank AS r,
           at.title_en, at.title_fr, at.icon_asset_url, at.threshold_value
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
  SELECT e.id, e.slug, e.r, e.title_en, e.title_fr, e.icon_asset_url, e.threshold_value
  FROM eligible e
  JOIN granted g ON g.tier_id = e.id;
END;
$$;

-- 4. Replace get_badge_status
-- Body from 20260819114837_quick_sessions_exclude_detached_days.sql + identical family CTEs.

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
  -- Bodyweight Trinity families (hardcoded catalog UUIDs, not a movement_family column).
  -- Circuit station set_logs count 1:1 — no block_exercise_id IS NULL filter.
  push_up_ids AS (
    SELECT unnest(ARRAY[
      'e63fe427-e910-4e0d-9f73-c51d85b36a3f',
      '5c7e172f-6c33-46cc-9886-4c31287623a8',
      'de827afb-d91b-400a-bd5f-415beca277df',
      '4a1a7219-bd91-4d59-9d73-2c30c5d9f0ce',
      '92d8460a-b5c6-449a-9659-004a7ee9565c',
      '01babef5-3139-4f37-b23f-88ef8d40279d',
      '426a5c8a-60bd-456c-b5c9-9bf92913f089',
      '6b46d77b-1291-44b9-9d40-f4da8930ae17'
    ]::uuid[]) AS exercise_id
  ),
  pull_up_ids AS (
    SELECT unnest(ARRAY[
      '261dca1e-9bae-4098-8676-6169597f9964',
      '00731099-9e50-4c90-a92e-0b4433881125',
      '5c0d0e9c-2118-4be4-a90b-31239029b7a3',
      '3ce11aeb-966e-4168-b744-902b7d357cfe',
      '366e1372-4fa0-40c4-816c-6fa83aa2c53d',
      'a3de462c-9cb9-4a59-ae31-11fbb842895b'
    ]::uuid[]) AS exercise_id
  ),
  bw_squat_ids AS (
    SELECT unnest(ARRAY[
      '41de0558-c044-4f90-b112-2b09c16e985c',
      'f1c88f28-8742-4862-985d-0752deca3675',
      '24e5654d-8414-4df6-b928-d2a4f6974d22',
      '473523ed-8ef9-493e-8e33-660de7979a7a',
      '113d352b-5f40-46ad-9d43-a1f5c9f33934',
      '4abd9a5f-78ed-4772-bf3d-153cccc7cb65'
    ]::uuid[]) AS exercise_id
  ),
  user_tz AS (
    SELECT COALESCE(
      (SELECT timezone FROM user_profiles WHERE user_id = p_user_id),
      'UTC'
    ) AS tz
  ),
  family_rep_totals AS (
    SELECT
      COALESCE(SUM(sl.reps_logged::int) FILTER (
        WHERE sl.exercise_id IN (SELECT exercise_id FROM push_up_ids)
      ), 0) AS push_ups,
      COALESCE(SUM(sl.reps_logged::int) FILTER (
        WHERE sl.exercise_id IN (SELECT exercise_id FROM pull_up_ids)
      ), 0) AS pull_ups,
      COALESCE(SUM(sl.reps_logged::int) FILTER (
        WHERE sl.exercise_id IN (SELECT exercise_id FROM bw_squat_ids)
      ), 0) AS bw_squats
    FROM set_logs sl
    JOIN user_sessions us ON us.id = sl.session_id
    WHERE sl.reps_logged IS NOT NULL
      AND sl.reps_logged ~ '^\d+$'
  ),
  qualifying_push_days AS (
    SELECT (sl.logged_at AT TIME ZONE (SELECT tz FROM user_tz))::date AS local_day
    FROM set_logs sl
    JOIN user_sessions us ON us.id = sl.session_id
    WHERE sl.exercise_id IN (SELECT exercise_id FROM push_up_ids)
      AND sl.reps_logged IS NOT NULL
      AND sl.reps_logged ~ '^\d+$'
      AND sl.logged_at IS NOT NULL
    GROUP BY 1
    HAVING SUM(sl.reps_logged::int) >= 100
  ),
  push_streaks AS (
    SELECT grp, COUNT(*)::int AS streak_len, MAX(local_day) AS end_day
    FROM (
      SELECT local_day,
             local_day - (ROW_NUMBER() OVER (ORDER BY local_day))::int AS grp
      FROM qualifying_push_days
    ) islands
    GROUP BY grp
  ),
  -- hundred_a_day is the live chain (today/yesterday grace), not MAX(streak_len).
  hundred_a_day_current AS (
    SELECT COALESCE(
      (
        SELECT s.streak_len
        FROM push_streaks s
        CROSS JOIN user_tz t
        WHERE s.end_day BETWEEN
          (now() AT TIME ZONE t.tz)::date - 1
          AND (now() AT TIME ZONE t.tz)::date
        ORDER BY s.end_day DESC
        LIMIT 1
      ),
      0
    )::numeric AS value
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
      WHERE us.workout_day_id IS NOT NULL
        AND (
          wd.program_id IS NULL
          OR (p.template_id IS NULL AND dc.day_count = 1)
        )

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

    -- === BODYWEIGHT TRINITY (#509) ===

    UNION ALL
    SELECT 'push_ups', push_ups::numeric FROM family_rep_totals
    UNION ALL
    SELECT 'pull_ups', pull_ups::numeric FROM family_rep_totals
    UNION ALL
    SELECT 'bw_squats', bw_squats::numeric FROM family_rep_totals
    UNION ALL
    SELECT 'bw_expert',
           LEAST(push_ups, pull_ups, bw_squats)::numeric
      FROM family_rep_totals
    UNION ALL
    SELECT 'hundred_a_day', value FROM hundred_a_day_current

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

REVOKE ALL ON FUNCTION check_and_grant_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_and_grant_achievements(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION get_badge_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_badge_status(uuid) TO authenticated, service_role;
