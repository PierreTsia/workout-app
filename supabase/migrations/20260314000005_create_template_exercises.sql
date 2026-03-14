CREATE TABLE template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id uuid NOT NULL REFERENCES template_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  sets integer NOT NULL DEFAULT 3,
  rep_range text NOT NULL,
  rest_seconds integer NOT NULL DEFAULT 90,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Template exercises readable by authenticated"
  ON template_exercises
  FOR SELECT
  USING (auth.role() = 'authenticated');
