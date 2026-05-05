-- resolve_exercises_batch — batch fuzzy/substring resolution for the MCP
-- `resolve_exercises` tool. Implements the "one round-trip per program" goal
-- of issue #310 (Epic Brief / Tech Plan: docs/Tech_Plan_—_MCP_—_Batch_Exercise_Resolution_#310.md).
--
-- This RPC mirrors the ranking strategy of search_exercises (see
-- `supabase/migrations/20260326120000_search_exercises.sql`) — substring
-- matches first, then pg_trgm similarity DESC, with the same 0.15 similarity
-- floor. Differences:
--   • Accepts an array of queries; iterates server-side, one trip total.
--   • Returns top-3 per query (the score-gap rule in `lib/scoreGap.ts`
--     decides ambiguous vs matched on the JS side).
--   • Returns equipment (raw column) — the handler derives `weight_convention`
--     via `formatWeightConvention()` (see T73 / `lib/format.ts`).
--   • Empty/whitespace queries yield zero rows for that query_idx; the
--     handler maps that to status="empty_query".
--
-- Extensions (pg_trgm, unaccent) are already enabled by the search_exercises
-- migration; no need to re-create them here.
--
-- KNOWN LIMITATION: input array length is not capped at the SQL layer.
-- The handler enforces a batch size limit (defined in the tool descriptor)
-- so abusive callers cannot DoS the function with thousands of queries.

CREATE OR REPLACE FUNCTION resolve_exercises_batch(
  queries text[]
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
  q_raw  text;
  q_norm text;
  qi     int;
BEGIN
  IF queries IS NULL OR array_length(queries, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR qi IN 1..array_length(queries, 1) LOOP
    q_raw  := queries[qi];
    q_norm := trim(lower(extensions.unaccent(coalesce(q_raw, ''))));

    -- Empty/whitespace queries return zero rows for this query_idx;
    -- the Edge Function maps absence to status="empty_query".
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
          WHEN extensions.unaccent(lower(e.name)) ILIKE '%' || q_norm || '%' THEN 0
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

GRANT EXECUTE ON FUNCTION public.resolve_exercises_batch(text[]) TO authenticated;
