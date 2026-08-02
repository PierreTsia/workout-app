-- Translation review queue (T158).
--
-- Deliberately not an extension of get_unreviewed_exercises_by_usage. That one
-- lists 18 columns by hand and rots on every schema addition, and it counts
-- prescriptions (workout_exercises + template_exercises). This one projects the
-- eight fields the queue renders and counts set_logs, which is actual reading
-- exposure: a translation nobody ever sees while training is not urgent.
--
-- The two queues stay watertight. This one filters and orders on
-- instructions_en_reviewed_at, never on reviewed_at, which content review and
-- image enrichment already share.
CREATE OR REPLACE FUNCTION get_translations_for_review()
RETURNS TABLE (
  id uuid,
  name text,
  name_en text,
  instructions jsonb,
  instructions_en jsonb,
  instructions_en_status text,
  instructions_en_audit jsonb,
  logged_sets bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.name,
    e.name_en,
    e.instructions,
    e.instructions_en,
    e.instructions_en_status,
    e.instructions_en_audit,
    COALESCE(sl.cnt, 0) AS logged_sets
  FROM exercises e
  LEFT JOIN (
    SELECT exercise_id, COUNT(*) AS cnt
    FROM set_logs
    GROUP BY exercise_id
  ) sl ON sl.exercise_id = e.id
  WHERE e.instructions_en IS NOT NULL
    AND e.instructions_en_reviewed_at IS NULL
  ORDER BY
    -- NULLS LAST because DESC puts them first by default, and the comparison is
    -- NULL for any row carrying English with no status. Such a row is malformed
    -- rather than urgent; it must not outrank a genuine flag.
    (e.instructions_en_status = 'flagged') DESC NULLS LAST,
    COALESCE(sl.cnt, 0) DESC,
    e.name ASC;
$$;

-- SECURITY DEFINER plus the default PUBLIC grant is how the existing RPCs are
-- already flagged by Supabase's linter. A new function does not have to inherit
-- that: the review queue is an admin surface, and nothing anonymous reads it.
REVOKE ALL ON FUNCTION get_translations_for_review() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_translations_for_review() TO authenticated, service_role;
