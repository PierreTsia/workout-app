-- Add difficulty_level column and extend get_exercise_filter_options to return difficulty_levels.
ALTER TABLE exercises
ADD COLUMN difficulty_level text
CONSTRAINT exercises_difficulty_level_check
CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced'));

CREATE OR REPLACE FUNCTION get_exercise_filter_options()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'muscle_groups', (SELECT coalesce(json_agg(muscle_group ORDER BY muscle_group), '[]')
                      FROM (SELECT DISTINCT muscle_group FROM exercises ORDER BY muscle_group) x),
    'equipment',     (SELECT coalesce(json_agg(equipment ORDER BY equipment), '[]')
                      FROM (SELECT DISTINCT equipment FROM exercises ORDER BY equipment) x),
    'difficulty_levels', (SELECT coalesce(json_agg(difficulty_level ORDER BY difficulty_level), '[]')
                          FROM (SELECT DISTINCT difficulty_level FROM exercises
                                WHERE difficulty_level IS NOT NULL
                                ORDER BY difficulty_level) x)
  );
$$;
