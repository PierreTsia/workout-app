CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_day_id uuid REFERENCES workout_days(id),
  workout_label_snapshot text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  total_sets_done integer NOT NULL DEFAULT 0,
  has_skipped_sets boolean NOT NULL DEFAULT false
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
