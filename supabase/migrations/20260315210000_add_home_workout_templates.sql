-- =========================================================================
-- Home Workout Templates
-- =========================================================================

INSERT INTO program_templates (name, description, min_days, max_days, primary_goal, experience_tags) VALUES
  ('Bodyweight Full Body', 'Zero equipment needed. 3 full body sessions per week using push-ups, pull-ups, dips, squats and core work. Progressive overload through reps and tempo. Perfect first program for training at home.', 3, 3, 'general_fitness', '{beginner,intermediate}'),
  ('Home Dumbbell Upper/Lower', 'All you need is a pair of dumbbells. Upper push, lower body, and upper pull split. Enough volume for real hypertrophy with minimal gear. Add bodyweight finishers for extra stimulus.', 3, 3, 'hypertrophy', '{beginner,intermediate}');

-- =========================================================================
-- Template Days
-- =========================================================================

-- Bodyweight Full Body (3 days)
INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order) VALUES
  ((SELECT id FROM program_templates WHERE name = 'Bodyweight Full Body'), 'Push Focus', 1, 'Chest, triceps, quads, core', 0),
  ((SELECT id FROM program_templates WHERE name = 'Bodyweight Full Body'), 'Pull Focus', 2, 'Back, biceps, quads, calves', 1),
  ((SELECT id FROM program_templates WHERE name = 'Bodyweight Full Body'), 'Mixed', 3, 'Full body — high rep conditioning', 2);

-- Home Dumbbell Upper/Lower (3 days)
INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order) VALUES
  ((SELECT id FROM program_templates WHERE name = 'Home Dumbbell Upper/Lower'), 'Upper Push', 1, 'Chest, shoulders, triceps', 0),
  ((SELECT id FROM program_templates WHERE name = 'Home Dumbbell Upper/Lower'), 'Lower Body', 2, 'Quads, glutes, calves, core', 1),
  ((SELECT id FROM program_templates WHERE name = 'Home Dumbbell Upper/Lower'), 'Upper Pull', 3, 'Back, biceps, traps', 2);

-- =========================================================================
-- Template Exercises
-- =========================================================================

-- ---- Bodyweight Full Body — Push Focus ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Push Focus'),
   (SELECT id FROM exercises WHERE name = 'Pompes'), 4, '10-15', 60, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Push Focus'),
   (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 4, '15-20', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Push Focus'),
   (SELECT id FROM exercises WHERE name = 'Dips'), 3, '8-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Push Focus'),
   (SELECT id FROM exercises WHERE name = 'Gainage planche'), 3, '30-60s', 45, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Push Focus'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '15-20', 45, 4);

-- ---- Bodyweight Full Body — Pull Focus ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Pull Focus'),
   (SELECT id FROM exercises WHERE name = 'Tractions'), 4, '6-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Pull Focus'),
   (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 4, '15-20', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Pull Focus'),
   (SELECT id FROM exercises WHERE name = 'Pompes'), 3, '10-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Pull Focus'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 3, '15-20', 45, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Pull Focus'),
   (SELECT id FROM exercises WHERE name = 'Gainage planche'), 3, '30-60s', 45, 4);

-- ---- Bodyweight Full Body — Mixed ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Mixed'),
   (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 4, '20-25', 45, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Mixed'),
   (SELECT id FROM exercises WHERE name = 'Tractions'), 3, '6-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Mixed'),
   (SELECT id FROM exercises WHERE name = 'Dips'), 3, '8-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Mixed'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '15-20', 45, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Bodyweight Full Body' AND td.day_label = 'Mixed'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 3, '20-25', 45, 4);

-- ---- Home Dumbbell — Upper Push ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Push'),
   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 4, '8-12', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Push'),
   (SELECT id FROM exercises WHERE name = 'Développé épaules haltères'), 3, '8-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Push'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Push'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps haltère'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Push'),
   (SELECT id FROM exercises WHERE name = 'Pompes'), 3, '12-15', 60, 4);

-- ---- Home Dumbbell — Lower Body ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Lower Body'),
   (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 4, '10-12', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Lower Body'),
   (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 4, '15-20', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Lower Body'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 4, '15-20', 45, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Lower Body'),
   (SELECT id FROM exercises WHERE name = 'Gainage planche'), 3, '30-60s', 45, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Lower Body'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '15-20', 45, 4);

-- ---- Home Dumbbell — Upper Pull ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Pull'),
   (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 4, '8-12', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Pull'),
   (SELECT id FROM exercises WHERE name = 'Tractions'), 3, '6-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Pull'),
   (SELECT id FROM exercises WHERE name = 'Curl marteau haltères'), 3, '10-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Pull'),
   (SELECT id FROM exercises WHERE name = 'Shrugs haltères'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Home Dumbbell Upper/Lower' AND td.day_label = 'Upper Pull'),
   (SELECT id FROM exercises WHERE name = 'Dips'), 3, '8-12', 60, 4);
