-- Volume and set credits by muscle group over a rolling window (Training Balance #160).
-- Primary muscle: 1 set credit + full volume (when reps-based).
-- Each taxonomy secondary: 0.5 set credit + 0.5 volume per set (per-set weighting).
-- Note: exercise detail views use buildBodyMapData(), which applies ceil(sets/2) per exercise
-- aggregate for secondaries — a different shape than this per-set RPC.

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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
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

GRANT EXECUTE ON FUNCTION get_volume_by_muscle_group(uuid, int, int) TO authenticated;
