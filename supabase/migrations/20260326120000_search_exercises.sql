-- Enable extensions for fuzzy and diacritic-insensitive search
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- NOTE: GIN expression indexes on unaccent(lower(name)) would be ideal, but
-- unaccent() is STABLE (not IMMUTABLE), so Postgres refuses expression indexes
-- on it without an IMMUTABLE wrapper function. At ~hundreds of exercises the
-- seq scan is sub-millisecond; we can revisit if the table grows significantly.

-- Hybrid fuzzy + substring search RPC
-- Combines ilike (exact substring, diacritic-insensitive) with pg_trgm similarity (typo-tolerant).
-- Substring matches are boosted to rank above fuzzy-only hits.
CREATE OR REPLACE FUNCTION search_exercises(
  search_term       text    DEFAULT '',
  filter_muscle_group text  DEFAULT NULL,
  filter_equipment  text[]  DEFAULT NULL,
  filter_difficulty text[]  DEFAULT NULL,
  page_offset       int     DEFAULT 0,
  page_limit        int     DEFAULT 20
)
RETURNS SETOF exercises
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  norm text;
  safe_offset int;
  safe_limit  int;
BEGIN
  norm := lower(extensions.unaccent(coalesce(search_term, '')));
  norm := trim(norm);

  safe_offset := GREATEST(coalesce(page_offset, 0), 0);
  safe_limit  := LEAST(GREATEST(coalesce(page_limit, 20), 1), 100);

  IF length(norm) = 0 THEN
    RETURN QUERY
      SELECT e.*
      FROM exercises e
      WHERE (filter_muscle_group IS NULL OR e.muscle_group = filter_muscle_group)
        AND (filter_equipment IS NULL OR e.equipment = ANY(filter_equipment))
        AND (filter_difficulty IS NULL OR e.difficulty_level = ANY(filter_difficulty))
      ORDER BY e.muscle_group, e.name, e.id
      OFFSET safe_offset
      LIMIT safe_limit;
  ELSE
    RETURN QUERY
      SELECT e.*
      FROM exercises e
      WHERE (filter_muscle_group IS NULL OR e.muscle_group = filter_muscle_group)
        AND (filter_equipment IS NULL OR e.equipment = ANY(filter_equipment))
        AND (filter_difficulty IS NULL OR e.difficulty_level = ANY(filter_difficulty))
        AND (
          extensions.unaccent(lower(e.name)) ILIKE '%' || norm || '%'
          OR extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || norm || '%'
          OR extensions.unaccent(lower(e.muscle_group)) ILIKE '%' || norm || '%'
          OR similarity(extensions.unaccent(lower(e.name)), norm) > 0.15
          OR similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), norm) > 0.15
        )
      ORDER BY
        CASE
          WHEN extensions.unaccent(lower(e.name)) ILIKE '%' || norm || '%' THEN 0
          WHEN extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || norm || '%' THEN 1
          ELSE 2
        END,
        GREATEST(
          similarity(extensions.unaccent(lower(e.name)), norm),
          similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), norm)
        ) DESC,
        e.name,
        e.id
      OFFSET safe_offset
      LIMIT safe_limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_exercises(text, text, text[], text[], int, int) TO authenticated;
