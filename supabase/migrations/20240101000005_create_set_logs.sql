CREATE TABLE set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  exercise_name_snapshot text NOT NULL,
  set_number integer NOT NULL,
  reps_logged text NOT NULL,
  weight_logged numeric NOT NULL,
  estimated_1rm numeric,
  was_pr boolean NOT NULL DEFAULT false,
  logged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own set_logs" ON set_logs
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM sessions WHERE id = session_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM sessions WHERE id = session_id)
  );
