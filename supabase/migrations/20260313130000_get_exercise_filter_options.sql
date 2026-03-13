-- Returns distinct muscle_group and equipment for exercise library filter dropdowns.
-- Used to avoid fetching all exercises when only filter options are needed.
CREATE OR REPLACE FUNCTION get_exercise_filter_options()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'muscle_groups', (SELECT coalesce(json_agg(muscle_group ORDER BY muscle_group), '[]') FROM (SELECT DISTINCT muscle_group FROM exercises ORDER BY muscle_group) x),
    'equipment', (SELECT coalesce(json_agg(equipment ORDER BY equipment), '[]') FROM (SELECT DISTINCT equipment FROM exercises ORDER BY equipment) x)
  );
$$;
