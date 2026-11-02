-- T715 (#729) — locale-aware ranking for resolve_exercises_batch (see the
-- sibling search_exercises_locale migration). DROP-then-CREATE because the
-- argument list changes; the new `p_locale` has DEFAULT 'en' so named callers
-- keep working.
--
-- Depends on: 20260506000736_resolve_exercises_batch.sql,
--             20260506004927_resolve_exercises_batch_cap_size.sql.

DROP FUNCTION IF EXISTS public.resolve_exercises_batch(text[]);
-- Also drop the new signature, so a replay (db push --include-all) is idempotent.
DROP FUNCTION IF EXISTS public.resolve_exercises_batch(text[], text);

CREATE FUNCTION resolve_exercises_batch(
  queries text[],
  p_locale text DEFAULT 'en'
)
RETURNS TABLE (
  query_idx                int,
  query_text               text,
  exercise_id              uuid,
  name                     text,
  name_en                  text,
  muscle_group             text,
  equipment                text,
  measurement_type         text,
  default_duration_seconds int,
  score                    real
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  q_raw    text;
  q_norm   text;
  qi       int;
  is_en    boolean;
BEGIN
  IF queries IS NULL OR array_length(queries, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Server-side batch cap (mirrors MAX_BATCH_SIZE in tools/resolveExercises.ts).
  IF array_length(queries, 1) > 30 THEN
    RAISE EXCEPTION 'queries array exceeds maximum size of 30 (got %)', array_length(queries, 1)
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  is_en := coalesce(p_locale, 'en') = 'en';

  FOR qi IN 1..array_length(queries, 1) LOOP
    q_raw  := queries[qi];
    q_norm := trim(lower(extensions.unaccent(coalesce(q_raw, ''))));

    IF length(q_norm) = 0 THEN
      CONTINUE;
    END IF;

    RETURN QUERY
      SELECT
        qi - 1                                                AS query_idx,
        q_raw                                                 AS query_text,
        e.id                                                  AS exercise_id,
        e.name,
        e.name_en,
        e.muscle_group,
        e.equipment,
        e.measurement_type::text,
        e.default_duration_seconds,
        GREATEST(
          similarity(extensions.unaccent(lower(e.name)), q_norm),
          similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), q_norm)
        )::real                                               AS score
      FROM exercises e
      WHERE
        extensions.unaccent(lower(e.name)) ILIKE '%' || q_norm || '%'
        OR extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || q_norm || '%'
        OR similarity(extensions.unaccent(lower(e.name)), q_norm) > 0.15
        OR similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), q_norm) > 0.15
      ORDER BY
        CASE
          WHEN is_en
            AND extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || q_norm || '%' THEN 0
          WHEN NOT is_en
            AND extensions.unaccent(lower(e.name)) ILIKE '%' || q_norm || '%' THEN 0
          WHEN extensions.unaccent(lower(e.name)) ILIKE '%' || q_norm || '%' THEN 1
          WHEN extensions.unaccent(lower(coalesce(e.name_en, ''))) ILIKE '%' || q_norm || '%' THEN 1
          ELSE 2
        END,
        GREATEST(
          similarity(extensions.unaccent(lower(e.name)), q_norm),
          similarity(extensions.unaccent(lower(coalesce(e.name_en, ''))), q_norm)
        ) DESC,
        e.name,
        e.id
      LIMIT 3;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_exercises_batch(text[], text) TO authenticated;
