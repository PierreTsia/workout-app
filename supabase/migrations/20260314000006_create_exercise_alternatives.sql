CREATE TABLE exercise_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  alternative_exercise_id uuid NOT NULL REFERENCES exercises(id),
  equipment_context text NOT NULL CHECK (equipment_context IN ('home', 'minimal')),
  UNIQUE(exercise_id, equipment_context)
);

ALTER TABLE exercise_alternatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alternatives readable by authenticated"
  ON exercise_alternatives
  FOR SELECT
  USING (auth.role() = 'authenticated');
