-- Toujours year rollups + unbounded Équilibre volume (T234 / #512).
-- No lifetime set_logs dump: Mix / pulse / Records / Tonnage are year buckets.
-- Mix precedence is identical to mixSlice() / MIX_SLICE_VECTORS:
-- CASE
--   WHEN has_catalog_circuit THEN 'circuits'
--   WHEN program_id IS NULL THEN 'quickWorkout'
--   ELSE 'programme'
-- END
-- Invoker role: RLS + user_id = auth.uid(). Keep privileged functions out of public.

CREATE OR REPLACE FUNCTION public.get_profile_all_time_rollups(p_tz text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH finished AS (
    SELECT
      s.id,
      s.started_at,
      s.finished_at,
      s.workout_day_id,
      (s.finished_at AT TIME ZONE p_tz)::date AS local_day,
      EXTRACT(YEAR FROM (s.finished_at AT TIME ZONE p_tz))::int AS year,
      COALESCE(
        s.active_duration_ms,
        GREATEST(
          0,
          (EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) * 1000)::bigint
        )
      ) AS duration_ms,
      wd.program_id,
      EXISTS (
        SELECT 1
        FROM exercise_blocks eb
        WHERE eb.workout_day_id = s.workout_day_id
          AND eb.benchmark_circuit_id IS NOT NULL
      ) AS has_catalog_circuit
    FROM sessions s
    LEFT JOIN workout_days wd ON wd.id = s.workout_day_id
    WHERE s.user_id = auth.uid()
      AND s.finished_at IS NOT NULL
  ),
  bounds AS (
    SELECT
      MIN(year) AS first_year,
      EXTRACT(YEAR FROM (now() AT TIME ZONE p_tz))::int AS last_year
    FROM finished
  ),
  years AS (
    SELECT generate_series(b.first_year, b.last_year) AS year
    FROM bounds b
    WHERE b.first_year IS NOT NULL
  ),
  sliced AS (
    SELECT
      f.*,
      CASE
        WHEN f.has_catalog_circuit THEN 'circuits'
        WHEN f.program_id IS NULL THEN 'quickWorkout'
        ELSE 'programme'
      END AS mix_slice
    FROM finished f
  ),
  year_mix AS (
    SELECT
      y.year,
      COUNT(*) FILTER (WHERE s.mix_slice = 'programme')::int AS programme,
      COUNT(*) FILTER (WHERE s.mix_slice = 'quickWorkout')::int AS quick_workout,
      COUNT(*) FILTER (WHERE s.mix_slice = 'circuits')::int AS circuits,
      COUNT(s.id)::int AS session_count,
      COALESCE(SUM(s.duration_ms), 0)::bigint AS duration_ms
    FROM years y
    LEFT JOIN sliced s ON s.year = y.year
    GROUP BY y.year
  ),
  year_tonnage AS (
    SELECT
      f.year,
      COALESCE(
        SUM(
          CASE
            WHEN sl.duration_seconds IS NULL
              AND sl.reps_logged IS NOT NULL
              AND sl.reps_logged ~ '^\d+$'
              AND sl.weight_logged > 0
            THEN sl.weight_logged * sl.reps_logged::numeric
            ELSE 0
          END
        ),
        0
      ) AS tonnage_kg
    FROM finished f
    JOIN set_logs sl ON sl.session_id = f.id
    GROUP BY f.year
  ),
  year_prs AS (
    SELECT
      f.year,
      COUNT(DISTINCT (sl.session_id, sl.exercise_id))::int AS pr_pairs
    FROM finished f
    JOIN set_logs sl ON sl.session_id = f.id
    WHERE sl.was_pr
    GROUP BY f.year
  ),
  year_rir AS (
    SELECT
      f.year,
      COUNT(*) FILTER (WHERE sl.rir = 0)::int AS rir0_num,
      COUNT(*) FILTER (WHERE sl.rir IS NOT NULL)::int AS rir0_den
    FROM finished f
    JOIN set_logs sl ON sl.session_id = f.id
    GROUP BY f.year
  ),
  year_rows AS (
    SELECT
      y.year,
      jsonb_build_object(
        'year', y.year,
        'mix', jsonb_build_object(
          'programme', COALESCE(m.programme, 0),
          'quickWorkout', COALESCE(m.quick_workout, 0),
          'circuits', COALESCE(m.circuits, 0)
        ),
        'tonnage_kg', COALESCE(t.tonnage_kg, 0),
        'pr_pairs', COALESCE(p.pr_pairs, 0),
        'rir0_num', COALESCE(r.rir0_num, 0),
        'rir0_den', COALESCE(r.rir0_den, 0),
        'session_count', COALESCE(m.session_count, 0),
        'duration_ms', COALESCE(m.duration_ms, 0)
      ) AS year_row
    FROM years y
    LEFT JOIN year_mix m ON m.year = y.year
    LEFT JOIN year_tonnage t ON t.year = y.year
    LEFT JOIN year_prs p ON p.year = y.year
    LEFT JOIN year_rir r ON r.year = y.year
    ORDER BY y.year
  ),
  career_regulars AS (
    SELECT
      sl.exercise_id,
      COUNT(DISTINCT sl.session_id) AS session_count,
      SUM(
        CASE
          WHEN sl.reps_logged IS NOT NULL AND sl.reps_logged ~ '^\d+$'
          THEN sl.reps_logged::numeric
          ELSE 0
        END
      ) AS reps,
      BOOL_OR(sl.reps_logged IS NOT NULL AND sl.reps_logged ~ '^\d+$') AS has_numeric,
      MAX(f.finished_at) AS last_logged_at
    FROM finished f
    JOIN set_logs sl ON sl.session_id = f.id
    GROUP BY sl.exercise_id
    HAVING COUNT(DISTINCT sl.session_id) >= 2
  )
  SELECT jsonb_build_object(
    'years', COALESCE((SELECT jsonb_agg(year_row ORDER BY year) FROM year_rows), '[]'::jsonb),
    'program_ids', COALESCE(
      (
        SELECT jsonb_agg(DISTINCT program_id)
        FROM finished
        WHERE program_id IS NOT NULL
      ),
      '[]'::jsonb
    ),
    'regulars', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'exercise_id', exercise_id,
            'reps', CASE WHEN has_numeric THEN reps ELSE NULL END,
            'last_logged_at', last_logged_at
          )
          ORDER BY
            CASE WHEN has_numeric THEN 0 ELSE 1 END,
            reps DESC,
            last_logged_at DESC
        )
        FROM (
          SELECT *
          FROM career_regulars
          ORDER BY
            CASE WHEN has_numeric THEN 0 ELSE 1 END,
            reps DESC,
            last_logged_at DESC
          LIMIT 8
        ) top_regulars
      ),
      '[]'::jsonb
    ),
    'pr_exercise_count', COALESCE(
      (
        SELECT COUNT(DISTINCT sl.exercise_id)::int
        FROM finished f
        JOIN set_logs sl ON sl.session_id = f.id
        WHERE sl.was_pr
      ),
      0
    ),
    'last_pr_day', (
      SELECT MAX(f.local_day)
      FROM finished f
      JOIN set_logs sl ON sl.session_id = f.id
      WHERE sl.was_pr
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_profile_all_time_rollups(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_all_time_rollups(text) TO authenticated;

-- Same 13-axis JSON as get_volume_by_muscle_group, no day clamp. Profil-only.
CREATE OR REPLACE FUNCTION public.get_volume_by_muscle_group_all_time(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_finished_sessions int;
  v_muscles json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'access denied: cannot query volume for another user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COUNT(DISTINCT s.id)::int
  INTO v_finished_sessions
  FROM sessions s
  WHERE s.user_id = auth.uid()
    AND s.finished_at IS NOT NULL
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
    WHERE s.user_id = auth.uid()
      AND s.finished_at IS NOT NULL
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

REVOKE ALL ON FUNCTION public.get_volume_by_muscle_group_all_time(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_volume_by_muscle_group_all_time(uuid) TO authenticated;
