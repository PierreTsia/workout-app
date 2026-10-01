-- Deviation reasons: capture the "why" of a load deviation (T266, ADR 0026).
-- One row per deviation; the event references the logged set by identity
-- (session_id + set_number) rather than copying prescribed_*/actual_* — those
-- live on set_logs and are read by joining. kind is text + CHECK: extending the
-- vocabulary or the kind set is a one-line migration, no enum rewrite.

ALTER TABLE sessions ADD COLUMN session_note text;

CREATE TABLE session_deviation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  workout_exercise_id uuid REFERENCES workout_exercises(id) ON DELETE SET NULL,
  exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
  set_number int,
  kind text NOT NULL CHECK (kind IN ('load_deviation')),
  reason_code text CHECK (reason_code IN ('pain','fatigue','strong','equipment','form','other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_deviation_events ENABLE ROW LEVEL SECURITY;

-- Own-row, and the referenced session must also belong to the caller — mirrors
-- the set_logs policy, so a client cannot attach an event to another account's
-- session (nor probe session ids through the FK).
CREATE POLICY "own deviation events" ON session_deviation_events
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX session_deviation_events_session_idx
  ON session_deviation_events (session_id);

CREATE INDEX session_deviation_events_user_created_idx
  ON session_deviation_events (user_id, created_at DESC);

-- One event per (session × slot × set × kind): a corrected reason overwrites
-- rather than duplicates, and a retried drain is idempotent. NULL slot/set are
-- distinct in Postgres, so future non-set kinds are unconstrained here.
CREATE UNIQUE INDEX session_deviation_events_identity_idx
  ON session_deviation_events (session_id, workout_exercise_id, set_number, kind);
