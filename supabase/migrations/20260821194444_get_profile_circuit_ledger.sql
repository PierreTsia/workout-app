-- Career catalog circuit ledger for Profil (T233 / #512).
-- Complete catalog block_runs only. Unbounded — PBs and window best
-- are sliced in TS against the full list. Jetable (null catalog id) excluded.
-- SECURITY INVOKER: RLS + user_id = auth.uid().

CREATE OR REPLACE FUNCTION public.get_profile_circuit_ledger()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(run_row ORDER BY started_at)
      FROM (
        SELECT
          br.started_at,
          jsonb_build_object(
            'session_id', br.session_id,
            'started_at', br.started_at,
            'finished_at', br.finished_at,
            'template_fingerprint', br.template_fingerprint,
            'benchmark_circuit_id', br.benchmark_circuit_id,
            'mode', br.mode,
            'cap_seconds', br.cap_seconds,
            'label', bc.label,
            'cells', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'session_id', sl.session_id,
                    'set_number', sl.set_number,
                    'reps_logged', sl.reps_logged,
                    'duration_seconds', sl.duration_seconds,
                    'logged_at', sl.logged_at,
                    'exercise_name', sl.exercise_name_snapshot
                  )
                  ORDER BY sl.logged_at
                )
                FROM set_logs sl
                JOIN block_exercises be ON be.id = sl.block_exercise_id
                WHERE sl.session_id = br.session_id
                  AND br.block_id IS NOT NULL
                  AND be.block_id = br.block_id
              ),
              '[]'::jsonb
            )
          ) AS run_row
        FROM block_runs br
        JOIN sessions s ON s.id = br.session_id
        JOIN benchmark_circuits bc ON bc.id = br.benchmark_circuit_id
        WHERE s.user_id = auth.uid()
          AND br.finished_at IS NOT NULL
          AND br.benchmark_circuit_id IS NOT NULL
      ) ledger
    ),
    '[]'::jsonb
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_circuit_ledger() TO authenticated;
