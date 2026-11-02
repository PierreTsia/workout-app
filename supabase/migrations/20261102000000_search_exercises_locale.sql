-- T715 (#729) — locale-aware ranking for search_exercises.
--
-- Today the RPC boosts French `name` (rank 0) then `name_en` (rank 1), so an
-- English query ("bench press") can rank a French-named row above the English
-- one. ADR 0035 adds an optional `p_locale` parameter that flips the boost.
--
-- Adding a parameter changes the signature, so we DROP the old function first
-- (CREATE OR REPLACE cannot change an argument list) and re-GRANT. The new
-- parameter has DEFAULT 'en', so existing named PostgREST callers keep working.
--
-- Depends on: 20260326120000_search_exercises.sql.

DROP FUNCTION IF EXISTS public.search_exercises(text, text, text[], text[], int, int);
-- Also drop the new signature, so a replay (db push --include-all) is idempotent.
DROP FUNCTION IF EXISTS public.search_exercises(text, text, text[], text[], int, int, text);

CREATE FUNCTION search_exercises(
  search_term         text    DEFAULT '',
  filter_muscle_group text    DEFAULT NULL,
  filter_equipment    text[]  DEFAULT NULL,
  filter_difficulty   text[]  DEFAULT NULL,
  page_offset         int     DEFAULT 0,
  page_limit          int     DEFAULT 20,
  p_locale            text    DEFAULT 'en'
)
RETURNS SETOF exercises
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  norm text;
  safe_offset int;
  safe_limit  int;
  is_en boolean;
BEGIN
  norm := trim(lower(extensions.unaccent(coalesce(search_term, ''))));
  is_en := coalesce(p_locale, 'en') = 'en';

  safe_offset := GREATEST(coalesce(page_offset, 0), 0);
  safe_limit  := LEAST(GREATEST(coalesce(page_limit, 20), 1), 100);

  IF length(norm) = 0 THEN
    RETURN QUERY
      SELECT e.*
      FROM exercises e
      WHERE (filter_muscle_group IS NULL OR e.muscle_group = filter_muscle_group)
        AND (filter_equipment IS NULL OR e.equipment = ANY(filter_equipment))
        AND (filter_difficulty IS NULL OR e.difficulty_level = ANY(filter_difficulty))
      ORDER BY
        e.muscle_group,
        CASE WHEN is_en THEN coalesce(e.name_en, e.name) ELSE e.name END,
        e.id
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
          WHEN is_en
            AND extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || norm || '%' THEN 0
          WHEN NOT is_en
            AND extensions.unaccent(lower(e.name)) ILIKE '%' || norm || '%' THEN 0
          WHEN extensions.unaccent(lower(e.name)) ILIKE '%' || norm || '%' THEN 1
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

GRANT EXECUTE ON FUNCTION public.search_exercises(text, text, text[], text[], int, int, text) TO authenticated;
