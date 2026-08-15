-- AMRAP termination mode + persisted Block Runs (#474, T183, ADR 0014).
-- Existing Circuits stay Tours: mode defaults to 'rounds', cap_seconds NULL.
-- No semantic backfill.

ALTER TABLE exercise_blocks
  ADD COLUMN mode text NOT NULL DEFAULT 'rounds'
    CHECK (mode IN ('rounds', 'amrap')),
  ADD COLUMN cap_seconds integer
    CHECK (cap_seconds IS NULL OR (cap_seconds >= 60 AND cap_seconds <= 3600));

ALTER TABLE exercise_blocks
  ADD CONSTRAINT exercise_blocks_mode_cap CHECK (
    (mode = 'rounds' AND cap_seconds IS NULL) OR
    (mode = 'amrap' AND cap_seconds IS NOT NULL)
  );

CREATE TABLE block_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES exercise_blocks(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  mode text NOT NULL CHECK (mode IN ('rounds', 'amrap')),
  cap_seconds integer NOT NULL,
  template_fingerprint text NOT NULL,
  UNIQUE (session_id, block_id)
);

ALTER TABLE block_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own block_runs" ON block_runs
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM sessions WHERE id = session_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM sessions WHERE id = session_id)
  );
