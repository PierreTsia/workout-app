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
  default_duration_seconds integer,
  usage_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
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
$$;
