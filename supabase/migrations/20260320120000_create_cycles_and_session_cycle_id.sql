CREATE TABLE cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE UNIQUE INDEX one_active_cycle_per_program
  ON cycles(program_id, user_id) WHERE finished_at IS NULL;

ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cycles" ON cycles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE sessions
  ADD COLUMN cycle_id uuid REFERENCES cycles(id);
