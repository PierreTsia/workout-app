CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age integer,
  weight_kg numeric,
  goal text NOT NULL CHECK (goal IN ('strength', 'hypertrophy', 'endurance', 'general_fitness')),
  experience text NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  equipment text NOT NULL CHECK (equipment IN ('home', 'gym', 'minimal')),
  training_days_per_week integer NOT NULL CHECK (training_days_per_week BETWEEN 2 AND 6),
  session_duration_minutes integer NOT NULL CHECK (session_duration_minutes IN (30, 45, 60, 90)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON user_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
