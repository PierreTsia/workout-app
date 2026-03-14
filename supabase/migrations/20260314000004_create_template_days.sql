CREATE TABLE template_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  day_label text NOT NULL,
  day_number integer NOT NULL,
  muscle_focus text,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE template_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Template days readable by authenticated"
  ON template_days
  FOR SELECT
  USING (auth.role() = 'authenticated');
