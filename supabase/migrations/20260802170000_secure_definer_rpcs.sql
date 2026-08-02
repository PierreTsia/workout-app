-- Close the SECURITY DEFINER hole audited in #440.
--
-- Two independent defects, both present on every function touched here.
--
-- 1. The grants. Supabase's default privileges hand EXECUTE to `anon` as an
--    explicit grant, on top of the implicit PUBLIC one. `REVOKE ... FROM PUBLIC`
--    alone leaves `anon=X` standing, which is how #439 stayed reachable without
--    a session after its REVOKE. Every REVOKE below names both.
--
-- 2. The body guard. `20260401000009_rpc_auth_guard.sql` reads
--
--      IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE
--
--    which is fail-open: an unauthenticated caller has a NULL auth.uid(), the
--    condition is false, no exception fires, and the function runs against
--    whatever p_user_id was supplied. The comment there ("allowed so the
--    function still works from SQL Editor / admin context") names a real
--    requirement — scripts/backfill-was-pr.ts and scripts/retroactive-badge-grant.sql
--    both call in with no JWT — but pays for it by admitting everyone keyless.
--
-- The fix for (2) is to name the trusted keyless callers instead of admitting
-- all of them, which is what is_trusted_backend_caller() below does.

-- Who is allowed to act without an auth.uid(), and nobody else.
--
-- SECURITY INVOKER on purpose: this has to observe the *caller's* session, and
-- it must never appear on the audit list it exists to shorten.
--
-- Three signals, because no single one separates the cases:
--
--   * auth.role() = 'service_role' — an edge function or a script holding the
--     service key. This is the case scripts/backfill-was-pr.ts hits when it
--     re-grants achievements for every user.
--
--   * auth.role() IS NULL AND session_user = 'postgres' — a direct superuser
--     connection with no PostgREST request context: the SQL Editor running
--     scripts/retroactive-badge-grant.sql, psql, supabase db push. Measured:
--     session_user = postgres, auth.role() NULL, request.jwt.claims unset.
--
--     Named as an allowlist rather than as "any session_user that is not
--     authenticator". The denylist form fails open by construction: the day
--     Supabase puts another login role in front of the API — a new pooler, a
--     gateway, a renamed connection role — every claimless request arriving
--     through it is silently promoted to trusted backend, and no test would
--     say so. We would find out the way we found out that REVOKE ... FROM
--     PUBLIC leaves anon's explicit grant standing. This whole migration is an
--     argument for failing closed, and this line has to make it too.
--
--     Widening the list is therefore a deliberate act — a second entry means a
--     second keyless caller has been shown to exist. As audited here, none is:
--     pg_cron is not installed, no function in the database calls any guarded
--     function, and the service-key client in
--     supabase/functions/_shared/supabase.ts reaches PostgREST through
--     `authenticator` carrying role='service_role', i.e. on the branch above.
--
--     session_user, not current_user: SECURITY DEFINER moves current_user to
--     the owner, and PostgREST switches role per request with SET LOCAL ROLE,
--     which leaves session_user at `authenticator`. So an API request fails
--     this test even when its claims are missing entirely, and we never have to
--     assume an anonymous request always presents role='anon'.
--
-- COALESCE, not bare comparison: a NULL predicate reads as false to an IF, so
-- an unwrapped one lets the caller through. That is the exact bug above.
CREATE OR REPLACE FUNCTION is_trusted_backend_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.uid() IS NULL
      AND (
        auth.role() = 'service_role'
        OR (auth.role() IS NULL AND session_user = 'postgres')
      ),
    false
  );
$$;

-- No grantee at all. This is an internal predicate, not an entry point, and a
-- PR arguing for a smaller reachable surface should not add one.
--
-- It stays callable where it is used because every call site is a SECURITY
-- DEFINER function owned by postgres: during that call the effective user is
-- the owner, so the EXECUTE check lands on postgres, which holds it implicitly
-- as owner. The calling role's privileges are never consulted. Verified on a
-- local harness — with this revoke in place an ordinary `authenticated` user
-- still reads badge status, volume and cycle stats, still grants achievements,
-- an admin still gets the review queue, and a direct RPC call to this function
-- is refused.
--
-- If this ever needs a grant to keep working, something has called it from
-- outside a definer function, and the right fix is to look at that call site
-- rather than to widen this. Making it SECURITY DEFINER would not be a grant
-- tweak but a design change: the predicate reads session_user and auth.role()
-- precisely because it has to observe the caller's real session.
REVOKE ALL ON FUNCTION is_trusted_backend_caller() FROM PUBLIC, anon, authenticated, service_role;


-- ── check_and_grant_achievements ────────────────────────────────────
--
-- The worst of the seven: it is the only one that writes. The INSERT into
-- user_achievements at the bottom means an unauthenticated caller could grant
-- badges into any account whose uuid they held, not merely read it.
--
-- Body copied verbatim from 20260419170000_early_bird_5_to_8.sql; the guard is
-- the only line that differs. CREATE OR REPLACE is not a patch.

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

REVOKE ALL ON FUNCTION check_and_grant_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_and_grant_achievements(uuid) TO authenticated, service_role;


-- ── get_badge_status ────────────────────────────────────────────────
--
-- Read-only, but it reports another user's session count, total volume, PR
-- count and unique exercises for any uuid handed to it.
--
-- Body copied verbatim from 20260419170000_early_bird_5_to_8.sql.

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

REVOKE ALL ON FUNCTION get_badge_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_badge_status(uuid) TO authenticated, service_role;


-- ── get_volume_by_muscle_group ──────────────────────────────────────
--
-- Same fail-open guard, same per-user data: volume and set credits by muscle
-- group over a rolling window. Called by the MCP edge function
-- (supabase/functions/mcp/tools/getTrainingStats.ts), which resolves the id
-- from the caller's own Bearer token and so arrives with a real auth.uid() —
-- it is not a keyless caller and needs no allowance here.
--
-- Body copied verbatim from 20260404120000_get_volume_by_muscle_group.sql.

CREATE OR REPLACE FUNCTION get_volume_by_muscle_group(
  p_user_id uuid,
  p_days int DEFAULT 30,
  p_offset_days int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_clamped int := LEAST(GREATEST(p_days, 1), 365);
  v_offset_clamped int := LEAST(GREATEST(p_offset_days, 0), 365);
  v_end timestamptz := now() - make_interval(days => v_offset_clamped);
  v_start timestamptz := v_end - make_interval(days => v_days_clamped);
  v_finished_sessions int;
  v_muscles json;
BEGIN
  IF NOT (
    COALESCE(auth.uid() = p_user_id, false)
    OR is_trusted_backend_caller()
  ) THEN
    RAISE EXCEPTION 'access denied: cannot query volume for another user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Aligns with UI copy: only sessions that actually contain set_logs in the window.
  SELECT COUNT(DISTINCT s.id)::int
  INTO v_finished_sessions
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.finished_at IS NOT NULL
    AND s.finished_at >= v_start
    AND s.finished_at < v_end
    AND EXISTS (SELECT 1 FROM set_logs sl WHERE sl.session_id = s.id);

  WITH taxonomy AS (
    SELECT unnest(
      ARRAY[
        'Pectoraux',
        'Dos',
        'Épaules',
        'Biceps',
        'Triceps',
        'Quadriceps',
        'Ischios',
        'Fessiers',
        'Adducteurs',
        'Mollets',
        'Abdos',
        'Trapèzes',
        'Lombaires'
      ]::text[]
    ) AS muscle_group
  ),
  session_scope AS (
    SELECT s.id
    FROM sessions s
    WHERE s.user_id = p_user_id
      AND s.finished_at IS NOT NULL
      AND s.finished_at >= v_start
      AND s.finished_at < v_end
  ),
  scored_sets AS (
    SELECT
      sl.exercise_id,
      e.muscle_group AS primary_mg,
      e.secondary_muscles,
      CASE
        WHEN sl.duration_seconds IS NULL
          AND sl.reps_logged IS NOT NULL
          AND sl.reps_logged ~ '^\d+$'
        THEN sl.weight_logged * sl.reps_logged::numeric
        ELSE 0::numeric
      END AS vol
    FROM set_logs sl
    JOIN session_scope sc ON sc.id = sl.session_id
    JOIN exercises e ON e.id = sl.exercise_id
  ),
  credits AS (
    SELECT
      ss.primary_mg AS mg,
      1::numeric AS set_credit,
      ss.vol AS vol_credit,
      ss.exercise_id
    FROM scored_sets ss
    WHERE ss.primary_mg IN (SELECT t.muscle_group FROM taxonomy t)

    UNION ALL

    SELECT
      sm.sec_mg AS mg,
      0.5::numeric AS set_credit,
      ss.vol * 0.5 AS vol_credit,
      ss.exercise_id
    FROM scored_sets ss
    CROSS JOIN LATERAL unnest(COALESCE(ss.secondary_muscles, ARRAY[]::text[])) AS sm(sec_mg)
    INNER JOIN taxonomy t ON t.muscle_group = sm.sec_mg
  ),
  aggregated AS (
    SELECT
      c.mg AS muscle_group,
      SUM(c.set_credit)::numeric AS total_sets,
      SUM(c.vol_credit)::numeric AS total_volume_kg,
      COUNT(DISTINCT c.exercise_id)::int AS exercise_count
    FROM credits c
    GROUP BY c.mg
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'muscle_group', t.muscle_group,
        'total_sets', COALESCE(a.total_sets, 0),
        'total_volume_kg', COALESCE(a.total_volume_kg, 0),
        'exercise_count', COALESCE(a.exercise_count, 0)
      )
      ORDER BY t.muscle_group
    ),
    '[]'::json
  )
  INTO v_muscles
  FROM taxonomy t
  LEFT JOIN aggregated a ON a.muscle_group = t.muscle_group;

  RETURN json_build_object(
    'finished_sessions', v_finished_sessions,
    'muscles', v_muscles
  );
END;
$$;

REVOKE ALL ON FUNCTION get_volume_by_muscle_group(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_volume_by_muscle_group(uuid, int, int) TO authenticated, service_role;


-- ── get_cycle_stats ─────────────────────────────────────────────────
--
-- This one never had a guard at all — not a fail-open one, none. It is keyed on
-- a cycle uuid rather than a user uuid, so the ownership check in
-- 20260401000009 was never written for it, and SECURITY DEFINER reads straight
-- past the "Users manage own cycles" policy. Anyone holding a cycle id got that
-- cycle's session count, total volume, PR count and date range.
--
-- Both parameters are checked. p_previous_cycle_id drives the delta block at
-- the bottom and reads a second cycle; guarding only the first would leave the
-- same hole one argument to the right.
--
-- The two ids fail differently, on purpose:
--
--   * p_cycle_id returns the existing 'cycle_not_found' shape, which is what
--     the function already answers for an unknown id and what useCycleStats
--     already renders as "no stats". A cycle you do not own is, from where you
--     stand, a cycle that does not exist — so this also denies the existence
--     oracle that raising would hand over.
--
--   * p_previous_cycle_id raises. There is no not-found path for it: dropping
--     it silently would return a summary with the delta block missing, and the
--     caller would read "no change since last cycle" off a permission error.
--
-- Body otherwise copied verbatim from
-- 20260325120000_restore_get_cycle_stats_active_duration.sql.

CREATE OR REPLACE FUNCTION get_cycle_stats(
  p_cycle_id uuid,
  p_previous_cycle_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_count   int;
  v_total_duration  bigint;
  v_total_sets      int;
  v_started_at      timestamptz;
  v_last_finished   timestamptz;
  v_total_volume    numeric;
  v_pr_count        int;
  v_duration_days   int;
  v_result          json;
  v_prev_volume     numeric;
  v_prev_sets       int;
  v_prev_prs        int;
BEGIN
  IF NOT is_trusted_backend_caller() THEN
    -- auth.uid() is NULL for an anonymous caller, so this EXISTS is false and
    -- the gate holds without a separate NULL test.
    IF NOT EXISTS (
      SELECT 1 FROM cycles c
      WHERE c.id = p_cycle_id AND c.user_id = auth.uid()
    ) THEN
      RETURN json_build_object('error', 'cycle_not_found');
    END IF;

    IF p_previous_cycle_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM cycles c
      WHERE c.id = p_previous_cycle_id AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'access denied: cannot compare against another user''s cycle'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  SELECT
    COUNT(*)::int,
    COALESCE(SUM(
      COALESCE(
        s.active_duration_ms,
        GREATEST(0, (EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) * 1000)::bigint)
      )
    ), 0)::bigint,
    COALESCE(SUM(s.total_sets_done), 0)::int,
    c.started_at,
    MAX(s.finished_at)
  INTO v_session_count, v_total_duration, v_total_sets, v_started_at, v_last_finished
  FROM cycles c
  LEFT JOIN sessions s ON s.cycle_id = c.id AND s.finished_at IS NOT NULL
  WHERE c.id = p_cycle_id
  GROUP BY c.id, c.started_at;

  IF v_started_at IS NULL THEN
    RETURN json_build_object('error', 'cycle_not_found');
  END IF;

  SELECT
    COALESCE(SUM(
      CASE
        WHEN sl.duration_seconds IS NULL
          AND sl.reps_logged IS NOT NULL
          AND sl.reps_logged ~ '^\d+$'
        THEN sl.weight_logged * sl.reps_logged::int
        ELSE 0
      END
    ), 0)::numeric,
    COUNT(*) FILTER (WHERE sl.was_pr AND sl.duration_seconds IS NULL)::int
  INTO v_total_volume, v_pr_count
  FROM set_logs sl
  JOIN sessions s ON s.id = sl.session_id
  WHERE s.cycle_id = p_cycle_id
    AND s.finished_at IS NOT NULL;

  v_duration_days := GREATEST(
    EXTRACT(DAY FROM (v_last_finished - v_started_at))::int + 1,
    1
  );

  v_result := json_build_object(
    'session_count',     v_session_count,
    'total_duration_ms', v_total_duration,
    'total_sets',        v_total_sets,
    'total_volume_kg',   v_total_volume,
    'pr_count',          v_pr_count,
    'started_at',        v_started_at,
    'last_finished_at',  v_last_finished,
    'duration_days',     v_duration_days
  );

  IF p_previous_cycle_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(
        CASE
          WHEN sl.duration_seconds IS NULL
            AND sl.reps_logged IS NOT NULL
            AND sl.reps_logged ~ '^\d+$'
          THEN sl.weight_logged * sl.reps_logged::int
          ELSE 0
        END
      ), 0)::numeric,
      COALESCE(SUM(s2.total_sets_done), 0)::int,
      COUNT(*) FILTER (WHERE sl.was_pr AND sl.duration_seconds IS NULL)::int
    INTO v_prev_volume, v_prev_sets, v_prev_prs
    FROM set_logs sl
    JOIN sessions s2 ON s2.id = sl.session_id
    WHERE s2.cycle_id = p_previous_cycle_id
      AND s2.finished_at IS NOT NULL;

    v_result := v_result::jsonb || jsonb_build_object(
      'delta_volume_pct', CASE WHEN v_prev_volume > 0
        THEN ROUND(((v_total_volume - v_prev_volume) / v_prev_volume * 100)::numeric, 1)
        ELSE NULL END,
      'delta_sets_pct', CASE WHEN v_prev_sets > 0
        THEN ROUND(((v_total_sets - v_prev_sets)::numeric / v_prev_sets * 100)::numeric, 1)
        ELSE NULL END,
      'delta_prs_pct', CASE WHEN v_prev_prs > 0
        THEN ROUND(((v_pr_count - v_prev_prs)::numeric / v_prev_prs * 100)::numeric, 1)
        ELSE NULL END
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_cycle_stats(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_cycle_stats(uuid, uuid) TO authenticated, service_role;


-- ── get_unreviewed_exercises_by_usage ───────────────────────────────
--
-- The function #440 names: SECURITY DEFINER, no GRANT or REVOKE of any kind,
-- no check in the body, and its only protection was that useExercisesForReview
-- is reached through /admin/review behind AdminGuard. A route guard is not a
-- boundary — POST /rest/v1/rpc/get_unreviewed_exercises_by_usage never loads
-- the router.
--
-- Gated on admin_users, the same predicate AdminGuard resolves client-side
-- (src/hooks/useIsAdmin.ts) and the same one 20260802150000 established for
-- get_translations_for_review. `authenticated` remains the grantee because the
-- page calls this over PostgREST as the signed-in admin.
--
-- Two incidental repairs, both forced:
--   * LANGUAGE sql -> plpgsql, purely so RAISE is possible at all.
--   * SET search_path = public, which this function never carried — one of the
--     six mutable-search_path findings in the Supabase linter.
--
-- Body otherwise copied verbatim from 20260414000000_create_review_rpc.sql;
-- the 19-column projection is unchanged, including its column-by-column list.

CREATE OR REPLACE FUNCTION get_unreviewed_exercises_by_usage()
RETURNS TABLE (
  id uuid,
  name text,
  muscle_group text,
  emoji text,
  is_system boolean,
  created_at timestamptz,
  youtube_url text,
  instructions jsonb,
  image_url text,
  equipment text,
  name_en text,
  source text,
  secondary_muscles text[],
  reviewed_at timestamptz,
  reviewed_by text,
  difficulty_level text,
  measurement_type text,
  default_duration_seconds int,
  usage_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- COALESCE because a token carrying no email claim makes the IN yield NULL,
  -- and NOT NULL is NULL, which an IF treats as false — i.e. it would wave the
  -- caller straight through.
  IF NOT COALESCE(
    auth.jwt() ->> 'email' IN (SELECT email FROM admin_users),
    false
  ) THEN
    RAISE EXCEPTION 'get_unreviewed_exercises_by_usage is restricted to admin users'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.muscle_group,
    e.emoji,
    e.is_system,
    e.created_at,
    e.youtube_url,
    e.instructions,
    e.image_url,
    e.equipment,
    e.name_en,
    e.source,
    e.secondary_muscles,
    e.reviewed_at,
    e.reviewed_by,
    e.difficulty_level,
    e.measurement_type,
    e.default_duration_seconds,
    COALESCE(we.cnt, 0) + COALESCE(te.cnt, 0) AS usage_count
  FROM exercises e
  LEFT JOIN (
    SELECT exercise_id, COUNT(*) AS cnt
    FROM workout_exercises
    GROUP BY exercise_id
  ) we ON we.exercise_id = e.id
  LEFT JOIN (
    SELECT exercise_id, COUNT(*) AS cnt
    FROM template_exercises
    GROUP BY exercise_id
  ) te ON te.exercise_id = e.id
  WHERE e.reviewed_at IS NULL
  ORDER BY COALESCE(we.cnt, 0) + COALESCE(te.cnt, 0) DESC, e.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_unreviewed_exercises_by_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_unreviewed_exercises_by_usage() TO authenticated, service_role;


-- ── get_exercise_filter_options ─────────────────────────────────────
--
-- Deliberately left with its body untouched, and here is the reason.
--
-- It reads nothing but the `exercises` table, whose SELECT policy is
-- "Anyone can read exercises" with USING (true) granted to PUBLIC. The catalog
-- is public by design, so SECURITY DEFINER buys this function no reach its
-- caller lacks: anon can already get the same three lists out of
-- GET /rest/v1/exercises?select=muscle_group,equipment,difficulty_level. There
-- is no per-user notion here to guard and nothing an in-body check could refuse.
--
-- anon loses EXECUTE anyway, because no caller wants it. All six consumers of
-- useExerciseFilterOptions sit under AuthGuard (/library/exercises, the builder
-- picker, the generator constraint step, the swap sheet, and two admin forms),
-- and the MCP resource refuses to run without a Bearer token. The revoke is
-- therefore free today, and it stops this from becoming a back door on the day
-- someone tightens the policy on `exercises` and forgets the definer function
-- reading past it.

REVOKE ALL ON FUNCTION get_exercise_filter_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_exercise_filter_options() TO authenticated, service_role;


-- ── validate_title_ownership ────────────────────────────────────────
--
-- Listed by the linter among the anon-executable seven, but it is a trigger
-- function: Postgres refuses a direct call ("trigger functions can only be
-- called as triggers") and PostgREST does not expose RETURNS trigger over
-- /rpc at all. The EXECUTE grant was never reachable, and there is no caller
-- to authorize — the ownership check it performs is already the point of it.
--
-- Revoked from every role rather than guarded, so the audit list in #440 is
-- the set of functions that genuinely take callers. Trigger firing does not
-- consult EXECUTE at run time; the privilege is checked once, against the
-- creator, at CREATE TRIGGER. trg_validate_title_ownership on user_profiles
-- keeps firing for `authenticated` with no grant at all.

REVOKE ALL ON FUNCTION validate_title_ownership() FROM PUBLIC, anon, authenticated, service_role;
