-- AI generation rate limiting tables

CREATE TABLE ai_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_generation_log_user_window
  ON ai_generation_log (user_id, created_at DESC);

ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE ai_whitelisted_users (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_whitelisted_users ENABLE ROW LEVEL SECURITY;

INSERT INTO ai_whitelisted_users (email) VALUES
  ('pierre.tsiakkaros@gmail.com'),
  ('pt2kos@gmail.com'),
  ('sarfati.jenni@gmail.com'),
  ('mooglyandi@gmail.com');
