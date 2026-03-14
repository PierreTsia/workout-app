-- Template data is system-level reference data (like exercises), not user data.
-- Use permissive SELECT to match the exercises table pattern.

DROP POLICY "Templates are readable by all authenticated users" ON program_templates;
CREATE POLICY "Anyone can read templates" ON program_templates FOR SELECT USING (true);

DROP POLICY "Template days readable by authenticated" ON template_days;
CREATE POLICY "Anyone can read template days" ON template_days FOR SELECT USING (true);

DROP POLICY "Template exercises readable by authenticated" ON template_exercises;
CREATE POLICY "Anyone can read template exercises" ON template_exercises FOR SELECT USING (true);

DROP POLICY "Alternatives readable by authenticated" ON exercise_alternatives;
CREATE POLICY "Anyone can read alternatives" ON exercise_alternatives FOR SELECT USING (true);
