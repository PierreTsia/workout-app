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
--
-- SECURITY DEFINER here bypasses RLS, and the set_logs count below crosses the
-- per-user policy on that table ("Users manage own set_logs"). Granting EXECUTE
-- to `authenticated` therefore has to be paired with an in-body authorization
-- check, or any signed-in user reads aggregate training volume for everybody.
--
-- This is the FIRST RPC in this repo to authorize against `admin_users`. Every
-- other SECURITY DEFINER function — `get_unreviewed_exercises_by_usage`
-- included — is protected by the client-side /admin route guard alone, which is
-- a suggestion rather than a boundary. Those are a separate, larger job; do not
-- read their absence of a gate as a precedent for removing this one.
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Raise rather than return zero rows. An empty result is indistinguishable
  -- from a drained queue, and the page renders "No translation left to review!"
  -- for it — a silent gate would make the UI lie to the very person debugging
  -- it. plpgsql, not sql, exists purely so this RAISE is possible.
  --
  -- Same predicate as the exercises RLS policies, wrapped in COALESCE because a
  -- token with no email claim makes the IN yield NULL, and `NOT NULL` is NULL,
  -- which an IF treats as false — i.e. it would let the caller straight through.
  IF NOT COALESCE(
    auth.jwt() ->> 'email' IN (SELECT email FROM admin_users),
    false
  ) THEN
    RAISE EXCEPTION 'get_translations_for_review is restricted to admin users'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
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
END;
$$;

-- `authenticated` is the right grantee even though the function is admin-only:
-- the app calls this over PostgREST as the signed-in admin, not as service_role,
-- so a narrower grant would break the page rather than secure it. Authorization
-- lives in the body; the grants only keep `anon` and PUBLIC off the entry point.
REVOKE ALL ON FUNCTION get_translations_for_review() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_translations_for_review() TO authenticated, service_role;
