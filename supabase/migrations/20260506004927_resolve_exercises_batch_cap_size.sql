-- Cap resolve_exercises_batch input array size at the SQL layer to prevent
-- direct-RPC DoS abuse. Caught by Copilot review on PR #319 (issue #310).
--
-- Rationale: the original migration (20260506000736_resolve_exercises_batch.sql)
-- relied on the Edge Function's MAX_BATCH_SIZE = 30 check in
-- `tools/resolveExercises.ts` to bound the per-call cost. But the function is
-- granted EXECUTE to `authenticated`, which means any client with a valid JWT
-- can call it directly via PostgREST (POST /rest/v1/rpc/resolve_exercises_batch)
-- and skip the Edge Function entirely — passing an arbitrarily large array
-- and forcing the inner FOR loop to run that many times.
--
-- Defence in depth: enforce the same 30-element cap inside the function body.
-- Keep the cap value identical to MAX_BATCH_SIZE in resolveExercises.ts;
-- bump both together if we ever raise the limit.
--
-- This migration uses CREATE OR REPLACE FUNCTION with the same signature and
-- body as the original, plus the IF guard at the top.

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

  -- Server-side batch cap (mirrors MAX_BATCH_SIZE in tools/resolveExercises.ts).
  -- Direct PostgREST callers can't bypass this by skipping the Edge Function.
  IF array_length(queries, 1) > 30 THEN
    RAISE EXCEPTION 'queries array exceeds maximum size of 30 (got %)', array_length(queries, 1)
      USING ERRCODE = 'invalid_parameter_value';
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
