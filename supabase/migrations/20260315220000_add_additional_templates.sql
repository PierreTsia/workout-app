-- =========================================================================
-- Additional Program Templates
-- =========================================================================

INSERT INTO program_templates (name, description, min_days, max_days, primary_goal, experience_tags) VALUES
  ('5x5 Compound Strength', 'The proven minimalist approach to getting strong. Three heavy compound lifts per session — squat, bench, deadlift, overhead press, rows. Low reps, long rest, linear progression. No fluff.', 3, 3, 'strength', '{intermediate,advanced}'),
  ('Machine Hypertrophy', 'Guided movements on machines and cables for safe, effective muscle growth. Ideal for beginners who want to build muscle without the learning curve of free weights. Full body coverage across 3 sessions.', 3, 3, 'hypertrophy', '{beginner}'),
  ('Lower Body Emphasis', 'Two dedicated leg days plus one upper maintenance day. Squats, hip thrusts, Romanian deadlifts, leg press, lunges — everything to build serious lower body strength and size.', 3, 3, 'hypertrophy', '{intermediate,advanced}'),
  ('Dumbbell Strength', 'Heavy dumbbell work with lower reps and longer rest. A real strength program for anyone with a pair of dumbbells and a pull-up bar. No machines, no barbells, no excuses.', 3, 3, 'strength', '{beginner,intermediate}');

-- =========================================================================
-- Template Days
-- =========================================================================

-- 5x5 Compound Strength (3 days)
INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order) VALUES
  ((SELECT id FROM program_templates WHERE name = '5x5 Compound Strength'), 'Squat + Bench', 1, 'Quads, chest, back, shoulders', 0),
  ((SELECT id FROM program_templates WHERE name = '5x5 Compound Strength'), 'Deadlift + OHP', 2, 'Posterior chain, shoulders, arms', 1),
  ((SELECT id FROM program_templates WHERE name = '5x5 Compound Strength'), 'Squat + Row', 3, 'Quads, back, chest, hamstrings', 2);

-- Machine Hypertrophy (3 days)
INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order) VALUES
  ((SELECT id FROM program_templates WHERE name = 'Machine Hypertrophy'), 'Upper', 1, 'Chest, back, shoulders, arms', 0),
  ((SELECT id FROM program_templates WHERE name = 'Machine Hypertrophy'), 'Lower', 2, 'Quads, hamstrings, calves, core', 1),
  ((SELECT id FROM program_templates WHERE name = 'Machine Hypertrophy'), 'Full Body', 3, 'Total body — isolation focus', 2);

-- Lower Body Emphasis (3 days)
INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order) VALUES
  ((SELECT id FROM program_templates WHERE name = 'Lower Body Emphasis'), 'Quad Dominant', 1, 'Quads, glutes, calves', 0),
  ((SELECT id FROM program_templates WHERE name = 'Lower Body Emphasis'), 'Upper Maintenance', 2, 'Chest, back, shoulders, core', 1),
  ((SELECT id FROM program_templates WHERE name = 'Lower Body Emphasis'), 'Hip & Hamstring', 3, 'Hamstrings, glutes, calves', 2);

-- Dumbbell Strength (3 days)
INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order) VALUES
  ((SELECT id FROM program_templates WHERE name = 'Dumbbell Strength'), 'Push', 1, 'Chest, shoulders, triceps', 0),
  ((SELECT id FROM program_templates WHERE name = 'Dumbbell Strength'), 'Lower', 2, 'Quads, hamstrings, calves, core', 1),
  ((SELECT id FROM program_templates WHERE name = 'Dumbbell Strength'), 'Pull', 3, 'Back, biceps, traps', 2);

-- =========================================================================
-- Template Exercises
-- =========================================================================

-- ---- 5x5 — Squat + Bench ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Bench'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 5, '3-5', 180, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Bench'),
   (SELECT id FROM exercises WHERE name = 'Développé couché'), 5, '3-5', 180, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Bench'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), 3, '6-8', 120, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Bench'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Bench'),
   (SELECT id FROM exercises WHERE name = 'Crunch à genoux poulie'), 3, '10-15', 60, 4);

-- ---- 5x5 — Deadlift + OHP ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Deadlift + OHP'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre'), 5, '3-5', 180, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Deadlift + OHP'),
   (SELECT id FROM exercises WHERE name = 'Arnold Press Haltères'), 5, '3-5', 150, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Deadlift + OHP'),
   (SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), 3, '6-8', 120, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Deadlift + OHP'),
   (SELECT id FROM exercises WHERE name = 'Curls stricts barre'), 3, '8-10', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Deadlift + OHP'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps corde'), 3, '8-10', 60, 4);

-- ---- 5x5 — Squat + Row ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Row'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 5, '3-5', 180, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Row'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise large pronation'), 5, '5-8', 150, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Row'),
   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 3, '8-10', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Row'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 3, '8-10', 90, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = '5x5 Compound Strength' AND td.day_label = 'Squat + Row'),
   (SELECT id FROM exercises WHERE name = 'Gainage planche'), 3, '30-60s', 60, 4);

-- ---- Machine Hypertrophy — Upper ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Upper'),
   (SELECT id FROM exercises WHERE name = 'Papillon bras tendus'), 3, '10-12', 60, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Upper'),
   (SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), 3, '10-12', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Upper'),
   (SELECT id FROM exercises WHERE name = 'Développé épaules haltères'), 3, '10-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Upper'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Upper'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps corde'), 3, '12-15', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Upper'),
   (SELECT id FROM exercises WHERE name = 'Curls biceps inclinés'), 3, '12-15', 60, 5);

-- ---- Machine Hypertrophy — Lower ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 4, '10-12', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Leg Curl assis'), 3, '10-12', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Extension de jambe machine'), 3, '12-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet machine'), 4, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Crunch assis machine'), 3, '12-15', 60, 4);

-- ---- Machine Hypertrophy — Full Body ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Full Body'),
   (SELECT id FROM exercises WHERE name = 'Pec Deck bras tendus'), 3, '10-12', 60, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Full Body'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise large pronation'), 3, '10-12', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Full Body'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 3, '12-15', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Full Body'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Full Body'),
   (SELECT id FROM exercises WHERE name = 'Papillon inverse'), 3, '12-15', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Machine Hypertrophy' AND td.day_label = 'Full Body'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '15-20', 45, 5);

-- ---- Lower Body Emphasis — Quad Dominant ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Quad Dominant'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 4, '6-8', 120, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Quad Dominant'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 3, '10-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Quad Dominant'),
   (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 3, '10-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Quad Dominant'),
   (SELECT id FROM exercises WHERE name = 'Extension de jambe machine'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Quad Dominant'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet machine'), 4, '12-15', 60, 4);

-- ---- Lower Body Emphasis — Upper Maintenance ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Upper Maintenance'),
   (SELECT id FROM exercises WHERE name = 'Développé couché'), 3, '8-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Upper Maintenance'),
   (SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), 3, '8-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Upper Maintenance'),
   (SELECT id FROM exercises WHERE name = 'Arnold Press Haltères'), 3, '10-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Upper Maintenance'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Upper Maintenance'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '15-20', 45, 4);

-- ---- Lower Body Emphasis — Hip & Hamstring ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Hip & Hamstring'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 4, '8-10', 120, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Hip & Hamstring'),
   (SELECT id FROM exercises WHERE name = 'Hip Thrust'), 4, '8-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Hip & Hamstring'),
   (SELECT id FROM exercises WHERE name = 'Leg Curl assis'), 3, '10-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Hip & Hamstring'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 3, '12-15', 90, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Lower Body Emphasis' AND td.day_label = 'Hip & Hamstring'),
   (SELECT id FROM exercises WHERE name = 'Extension mollet machine'), 4, '12-15', 60, 4);

-- ---- Dumbbell Strength — Push ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 4, '6-8', 120, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Arnold Press Haltères'), 4, '6-8', 120, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '10-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps haltère'), 3, '8-10', 90, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Pompes'), 3, '10-15', 60, 4);

-- ---- Dumbbell Strength — Lower ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 4, '8-10', 120, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 4, '15-20', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 4, '12-15', 45, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Gainage planche'), 3, '30-60s', 45, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Lower'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '15-20', 45, 4);

-- ---- Dumbbell Strength — Pull ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 4, '6-8', 120, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Tractions'), 4, '6-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Curl marteau haltères'), 3, '8-10', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Shrugs haltères'), 3, '8-10', 90, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Dumbbell Strength' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Dips'), 3, '8-12', 60, 4);
