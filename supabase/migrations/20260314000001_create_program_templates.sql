CREATE TABLE program_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  min_days integer NOT NULL,
  max_days integer NOT NULL,
  primary_goal text NOT NULL,
  experience_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are readable by all authenticated users"
  ON program_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');
