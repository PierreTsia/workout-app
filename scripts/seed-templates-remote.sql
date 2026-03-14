-- Run against remote Supabase to seed template data.
-- Safe to re-run: uses ON CONFLICT / existence checks.
-- Assumes exercises already exist (600+ from wger import).
--
-- Usage: supabase db execute --file scripts/seed-templates-remote.sql
-- Or: paste into Supabase SQL Editor

BEGIN;

-- 1. Insert any missing exercises needed by templates
INSERT INTO exercises (name, muscle_group, emoji, is_system, equipment, name_en) VALUES
  ('Pompes', 'Pectoraux', '🏋️', true, 'bodyweight', 'Push-ups'),
  ('Tractions', 'Dos', '🚣', true, 'bodyweight', 'Pull-ups'),
  ('Dips', 'Triceps', '💪', true, 'bodyweight', 'Dips'),
  ('Squat barre', 'Quadriceps', '🦵', true, 'barbell', 'Barbell Squat'),
  ('Squat au poids du corps', 'Quadriceps', '🦵', true, 'bodyweight', 'Bodyweight Squat'),
  ('Fentes haltères', 'Quadriceps', '🦵', true, 'dumbbell', 'Dumbbell Lunges'),
  ('Gainage planche', 'Abdos', '🔥', true, 'bodyweight', 'Plank'),
  ('Crunchs', 'Abdos', '🔥', true, 'bodyweight', 'Crunches'),
  ('Développé haltères', 'Pectoraux', '🏋️', true, 'dumbbell', 'Dumbbell Bench Press'),
  ('Rowing haltère', 'Dos', '🚣', true, 'dumbbell', 'Dumbbell Row'),
  ('Développé épaules haltères', 'Épaules', '🙆', true, 'dumbbell', 'Dumbbell Shoulder Press'),
  ('Curl marteau haltères', 'Biceps', '💪', true, 'dumbbell', 'Hammer Curl'),
  ('Extension triceps haltère', 'Triceps', '💪', true, 'dumbbell', 'Dumbbell Triceps Extension'),
  ('Soulevé de terre', 'Dos', '🏋️', true, 'barbell', 'Deadlift'),
  ('Hip Thrust', 'Fessiers', '🍑', true, 'barbell', 'Hip Thrust'),
  ('Élévation mollet debout', 'Mollets', '🦶', true, 'bodyweight', 'Standing Calf Raise'),
  ('Rangées prise serrée neutre', 'Dos', '🚣', true, 'machine', 'Rowing Seated Narrow Grip'),
  ('Rangées prise large pronation', 'Dos', '💪', true, 'machine', 'Seated Cable Row')
ON CONFLICT (name) DO NOTHING;

-- 2. Program templates
INSERT INTO program_templates (name, description, min_days, max_days, primary_goal, experience_tags) VALUES
  ('Full Body', 'Compound-heavy full body sessions. Low volume per muscle, high frequency. Ideal for beginners building a strength base.', 2, 4, 'general_fitness', '{beginner}'),
  ('Upper/Lower', 'Balanced upper/lower split with push-pull balance. Good volume per session for hypertrophy.', 3, 4, 'hypertrophy', '{intermediate}'),
  ('PPL (Push/Pull/Legs)', 'Classic bodybuilding split. High volume, each muscle hit twice per week at 6 days.', 3, 6, 'hypertrophy', '{intermediate,advanced}'),
  ('GZCLP', 'Linear progression with heavy compounds (T1), moderate volume accessories (T2/T3). Great for building raw strength.', 3, 4, 'strength', '{beginner,intermediate}'),
  ('Muscular Endurance', 'High reps, short rest, circuit-style training. Builds muscular endurance and work capacity.', 3, 4, 'endurance', '{beginner,intermediate,advanced}')
ON CONFLICT (name) DO NOTHING;

-- 3. Template days (skip if already populated)
INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order)
SELECT * FROM (VALUES
  ((SELECT id FROM program_templates WHERE name = 'Full Body'), 'Full Body A', 1, 'Full body — press focus', 0),
  ((SELECT id FROM program_templates WHERE name = 'Full Body'), 'Full Body B', 2, 'Full body — hinge focus', 1),
  ((SELECT id FROM program_templates WHERE name = 'Full Body'), 'Full Body C', 3, 'Full body — unilateral focus', 2),
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Upper A', 1, 'Chest, back, shoulders, arms', 0),
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Lower A', 2, 'Quads, hamstrings, calves, core', 1),
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Upper B', 3, 'Chest, back, shoulders, arms', 2),
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Lower B', 4, 'Quads, hamstrings, calves, core', 3),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Push', 1, 'Chest, shoulders, triceps', 0),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Pull', 2, 'Back, biceps, rear delts', 1),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Legs', 3, 'Quads, hamstrings, calves, core', 2),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Push B', 4, 'Chest, shoulders, triceps', 3),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Pull B', 5, 'Back, biceps, rear delts', 4),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Legs B', 6, 'Quads, hamstrings, calves, core', 5),
  ((SELECT id FROM program_templates WHERE name = 'GZCLP'), 'GZCLP Day A', 1, 'Squat + bench focus', 0),
  ((SELECT id FROM program_templates WHERE name = 'GZCLP'), 'GZCLP Day B', 2, 'Deadlift + OHP focus', 1),
  ((SELECT id FROM program_templates WHERE name = 'GZCLP'), 'GZCLP Day C', 3, 'Squat + bench variation', 2),
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Upper Circuit', 1, 'Upper body endurance', 0),
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Lower Circuit', 2, 'Lower body endurance', 1),
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Full Body Circuit', 3, 'Total body conditioning', 2),
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Conditioning', 4, 'Mixed endurance + core', 3)
) AS v(template_id, day_label, day_number, muscle_focus, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM template_days LIMIT 1);

-- 4. Template exercises (skip if already populated)
-- Helper function to look up a template_day
CREATE OR REPLACE FUNCTION _td(tpl text, lbl text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id
  WHERE pt.name = tpl AND td.day_label = lbl LIMIT 1;
$$;
-- Helper function to look up an exercise
CREATE OR REPLACE FUNCTION _ex(n text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM exercises WHERE name = n LIMIT 1;
$$;

INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order)
SELECT * FROM (VALUES
  -- Full Body A
  (_td('Full Body','Full Body A'), _ex('Développé couché'), 3, '8-12', 90, 0),
  (_td('Full Body','Full Body A'), _ex('Squat barre'), 3, '8-12', 90, 1),
  (_td('Full Body','Full Body A'), _ex('Tirage latéral prise large'), 3, '8-12', 90, 2),
  (_td('Full Body','Full Body A'), _ex('Élévations latérales'), 3, '12-15', 60, 3),
  (_td('Full Body','Full Body A'), _ex('Crunchs'), 3, '15-20', 60, 4),
  -- Full Body B
  (_td('Full Body','Full Body B'), _ex('Développé haltères'), 3, '8-12', 90, 0),
  (_td('Full Body','Full Body B'), _ex('Soulevé de terre roumain'), 3, '8-12', 90, 1),
  (_td('Full Body','Full Body B'), _ex('Rowing haltère'), 3, '8-12', 90, 2),
  (_td('Full Body','Full Body B'), _ex('Arnold Press Haltères'), 3, '8-12', 60, 3),
  (_td('Full Body','Full Body B'), _ex('Gainage planche'), 3, '30-60s', 60, 4),
  -- Full Body C
  (_td('Full Body','Full Body C'), _ex('Pompes'), 3, '10-15', 60, 0),
  (_td('Full Body','Full Body C'), _ex('Fentes haltères'), 3, '10-12', 90, 1),
  (_td('Full Body','Full Body C'), _ex('Rangées prise serrée neutre'), 3, '8-12', 90, 2),
  (_td('Full Body','Full Body C'), _ex('Élévations latérales'), 3, '12-15', 60, 3),
  (_td('Full Body','Full Body C'), _ex('Crunch assis machine'), 3, '12-15', 60, 4),
  -- Upper A
  (_td('Upper/Lower','Upper A'), _ex('Développé couché'), 4, '8-10', 90, 0),
  (_td('Upper/Lower','Upper A'), _ex('Tirage latéral prise large'), 4, '8-10', 90, 1),
  (_td('Upper/Lower','Upper A'), _ex('Arnold Press Haltères'), 3, '10-12', 60, 2),
  (_td('Upper/Lower','Upper A'), _ex('Rangées prise serrée neutre'), 3, '10-12', 60, 3),
  (_td('Upper/Lower','Upper A'), _ex('Extension triceps corde'), 3, '10-12', 60, 4),
  (_td('Upper/Lower','Upper A'), _ex('Curls stricts barre'), 3, '10-12', 60, 5),
  -- Lower A
  (_td('Upper/Lower','Lower A'), _ex('Squat barre'), 4, '6-8', 120, 0),
  (_td('Upper/Lower','Lower A'), _ex('Soulevé de terre roumain'), 3, '8-10', 90, 1),
  (_td('Upper/Lower','Lower A'), _ex('Presse à cuisse'), 3, '10-12', 90, 2),
  (_td('Upper/Lower','Lower A'), _ex('Leg Curl assis'), 3, '10-12', 60, 3),
  (_td('Upper/Lower','Lower A'), _ex('Élévation mollet machine'), 4, '12-15', 60, 4),
  (_td('Upper/Lower','Lower A'), _ex('Crunch assis machine'), 3, '12-15', 60, 5),
  -- Upper B
  (_td('Upper/Lower','Upper B'), _ex('Développé haltères'), 4, '8-10', 90, 0),
  (_td('Upper/Lower','Upper B'), _ex('Rangées prise large pronation'), 4, '8-10', 90, 1),
  (_td('Upper/Lower','Upper B'), _ex('Élévations latérales'), 3, '12-15', 60, 2),
  (_td('Upper/Lower','Upper B'), _ex('Papillon inverse'), 3, '12-15', 60, 3),
  (_td('Upper/Lower','Upper B'), _ex('Skull Crusher incliné'), 3, '10-12', 60, 4),
  (_td('Upper/Lower','Upper B'), _ex('Curls biceps inclinés'), 3, '10-12', 60, 5),
  -- Lower B
  (_td('Upper/Lower','Lower B'), _ex('Presse à cuisse'), 4, '8-10', 90, 0),
  (_td('Upper/Lower','Lower B'), _ex('Soulevé de terre roumain'), 3, '10-12', 90, 1),
  (_td('Upper/Lower','Lower B'), _ex('Extension de jambe machine'), 3, '12-15', 60, 2),
  (_td('Upper/Lower','Lower B'), _ex('Leg Curl assis'), 3, '12-15', 60, 3),
  (_td('Upper/Lower','Lower B'), _ex('Extension mollet machine'), 4, '12-15', 60, 4),
  (_td('Upper/Lower','Lower B'), _ex('Crunch à genoux poulie'), 3, '12-15', 60, 5),
  -- PPL Push
  (_td('PPL (Push/Pull/Legs)','Push'), _ex('Développé couché'), 4, '6-8', 90, 0),
  (_td('PPL (Push/Pull/Legs)','Push'), _ex('Papillon bras tendus'), 3, '10-12', 60, 1),
  (_td('PPL (Push/Pull/Legs)','Push'), _ex('Arnold Press Haltères'), 3, '8-10', 90, 2),
  (_td('PPL (Push/Pull/Legs)','Push'), _ex('Élévations latérales'), 3, '12-15', 60, 3),
  (_td('PPL (Push/Pull/Legs)','Push'), _ex('Skull Crusher incliné'), 3, '10-12', 60, 4),
  (_td('PPL (Push/Pull/Legs)','Push'), _ex('Extension triceps corde'), 3, '12-15', 60, 5),
  -- PPL Pull
  (_td('PPL (Push/Pull/Legs)','Pull'), _ex('Tirage latéral prise large'), 4, '6-8', 90, 0),
  (_td('PPL (Push/Pull/Legs)','Pull'), _ex('Rangées prise serrée neutre'), 3, '8-10', 90, 1),
  (_td('PPL (Push/Pull/Legs)','Pull'), _ex('Papillon inverse'), 3, '12-15', 60, 2),
  (_td('PPL (Push/Pull/Legs)','Pull'), _ex('Shrugs haltères'), 3, '10-12', 60, 3),
  (_td('PPL (Push/Pull/Legs)','Pull'), _ex('Curls stricts barre'), 3, '8-10', 60, 4),
  (_td('PPL (Push/Pull/Legs)','Pull'), _ex('Curls biceps inclinés'), 3, '10-12', 60, 5),
  -- PPL Legs
  (_td('PPL (Push/Pull/Legs)','Legs'), _ex('Squat barre'), 4, '6-8', 120, 0),
  (_td('PPL (Push/Pull/Legs)','Legs'), _ex('Presse à cuisse'), 3, '10-12', 90, 1),
  (_td('PPL (Push/Pull/Legs)','Legs'), _ex('Soulevé de terre roumain'), 3, '8-10', 90, 2),
  (_td('PPL (Push/Pull/Legs)','Legs'), _ex('Leg Curl assis'), 3, '10-12', 60, 3),
  (_td('PPL (Push/Pull/Legs)','Legs'), _ex('Élévation mollet machine'), 4, '12-15', 60, 4),
  (_td('PPL (Push/Pull/Legs)','Legs'), _ex('Crunch assis machine'), 3, '12-15', 60, 5),
  -- PPL Push B
  (_td('PPL (Push/Pull/Legs)','Push B'), _ex('Développé haltères'), 4, '8-10', 90, 0),
  (_td('PPL (Push/Pull/Legs)','Push B'), _ex('Pec Deck bras tendus'), 3, '10-12', 60, 1),
  (_td('PPL (Push/Pull/Legs)','Push B'), _ex('Développé épaules haltères'), 3, '8-10', 90, 2),
  (_td('PPL (Push/Pull/Legs)','Push B'), _ex('Élévations latérales'), 3, '12-15', 60, 3),
  (_td('PPL (Push/Pull/Legs)','Push B'), _ex('Extension triceps corde'), 3, '12-15', 60, 4),
  (_td('PPL (Push/Pull/Legs)','Push B'), _ex('Dips'), 3, '8-12', 60, 5),
  -- PPL Pull B
  (_td('PPL (Push/Pull/Legs)','Pull B'), _ex('Rangées prise large pronation'), 4, '8-10', 90, 0),
  (_td('PPL (Push/Pull/Legs)','Pull B'), _ex('Tractions'), 3, '6-10', 90, 1),
  (_td('PPL (Push/Pull/Legs)','Pull B'), _ex('Papillon inverse'), 3, '12-15', 60, 2),
  (_td('PPL (Push/Pull/Legs)','Pull B'), _ex('Shrugs haltères'), 3, '10-12', 60, 3),
  (_td('PPL (Push/Pull/Legs)','Pull B'), _ex('Curl marteau haltères'), 3, '10-12', 60, 4),
  (_td('PPL (Push/Pull/Legs)','Pull B'), _ex('Curls biceps inclinés'), 3, '12-15', 60, 5),
  -- PPL Legs B
  (_td('PPL (Push/Pull/Legs)','Legs B'), _ex('Presse à cuisse'), 4, '8-10', 90, 0),
  (_td('PPL (Push/Pull/Legs)','Legs B'), _ex('Fentes haltères'), 3, '10-12', 90, 1),
  (_td('PPL (Push/Pull/Legs)','Legs B'), _ex('Extension de jambe machine'), 3, '12-15', 60, 2),
  (_td('PPL (Push/Pull/Legs)','Legs B'), _ex('Leg Curl assis'), 3, '12-15', 60, 3),
  (_td('PPL (Push/Pull/Legs)','Legs B'), _ex('Extension mollet machine'), 4, '15-20', 45, 4),
  (_td('PPL (Push/Pull/Legs)','Legs B'), _ex('Crunch à genoux poulie'), 3, '12-15', 60, 5),
  -- GZCLP Day A
  (_td('GZCLP','GZCLP Day A'), _ex('Squat barre'), 5, '3-5', 180, 0),
  (_td('GZCLP','GZCLP Day A'), _ex('Développé couché'), 3, '8-10', 120, 1),
  (_td('GZCLP','GZCLP Day A'), _ex('Tirage latéral prise large'), 3, '8-12', 90, 2),
  (_td('GZCLP','GZCLP Day A'), _ex('Élévations latérales'), 3, '12-15', 60, 3),
  (_td('GZCLP','GZCLP Day A'), _ex('Crunch à genoux poulie'), 3, '10-15', 60, 4),
  -- GZCLP Day B
  (_td('GZCLP','GZCLP Day B'), _ex('Soulevé de terre'), 5, '3-5', 180, 0),
  (_td('GZCLP','GZCLP Day B'), _ex('Arnold Press Haltères'), 3, '8-10', 120, 1),
  (_td('GZCLP','GZCLP Day B'), _ex('Rangées prise serrée neutre'), 3, '8-12', 90, 2),
  (_td('GZCLP','GZCLP Day B'), _ex('Curls stricts barre'), 3, '8-12', 60, 3),
  (_td('GZCLP','GZCLP Day B'), _ex('Extension triceps corde'), 3, '10-12', 60, 4),
  -- GZCLP Day C
  (_td('GZCLP','GZCLP Day C'), _ex('Développé couché'), 5, '3-5', 180, 0),
  (_td('GZCLP','GZCLP Day C'), _ex('Squat barre'), 3, '8-10', 120, 1),
  (_td('GZCLP','GZCLP Day C'), _ex('Rangées prise large pronation'), 3, '8-12', 90, 2),
  (_td('GZCLP','GZCLP Day C'), _ex('Curls biceps inclinés'), 3, '10-12', 60, 3),
  (_td('GZCLP','GZCLP Day C'), _ex('Skull Crusher incliné'), 3, '10-12', 60, 4),
  -- Muscular Endurance — Upper Circuit
  (_td('Muscular Endurance','Upper Circuit'), _ex('Pompes'), 3, '15-20', 30, 0),
  (_td('Muscular Endurance','Upper Circuit'), _ex('Rowing haltère'), 3, '15-20', 30, 1),
  (_td('Muscular Endurance','Upper Circuit'), _ex('Développé épaules haltères'), 3, '15-20', 30, 2),
  (_td('Muscular Endurance','Upper Circuit'), _ex('Élévations latérales'), 3, '15-20', 30, 3),
  (_td('Muscular Endurance','Upper Circuit'), _ex('Extension triceps haltère'), 3, '15-20', 30, 4),
  (_td('Muscular Endurance','Upper Circuit'), _ex('Curl marteau haltères'), 3, '15-20', 30, 5),
  -- Muscular Endurance — Lower Circuit
  (_td('Muscular Endurance','Lower Circuit'), _ex('Fentes haltères'), 3, '15-20', 30, 0),
  (_td('Muscular Endurance','Lower Circuit'), _ex('Presse à cuisse'), 3, '15-20', 30, 1),
  (_td('Muscular Endurance','Lower Circuit'), _ex('Leg Curl assis'), 3, '15-20', 30, 2),
  (_td('Muscular Endurance','Lower Circuit'), _ex('Extension de jambe machine'), 3, '15-20', 30, 3),
  (_td('Muscular Endurance','Lower Circuit'), _ex('Élévation mollet machine'), 3, '20-25', 30, 4),
  (_td('Muscular Endurance','Lower Circuit'), _ex('Gainage planche'), 3, '30-60s', 30, 5),
  -- Muscular Endurance — Full Body Circuit
  (_td('Muscular Endurance','Full Body Circuit'), _ex('Développé haltères'), 3, '15-20', 30, 0),
  (_td('Muscular Endurance','Full Body Circuit'), _ex('Squat au poids du corps'), 3, '20-25', 30, 1),
  (_td('Muscular Endurance','Full Body Circuit'), _ex('Tractions'), 3, '8-12', 30, 2),
  (_td('Muscular Endurance','Full Body Circuit'), _ex('Élévations latérales'), 3, '15-20', 30, 3),
  (_td('Muscular Endurance','Full Body Circuit'), _ex('Crunchs'), 3, '20-25', 30, 4),
  (_td('Muscular Endurance','Full Body Circuit'), _ex('Élévation mollet debout'), 3, '20-25', 30, 5),
  -- Muscular Endurance — Conditioning
  (_td('Muscular Endurance','Conditioning'), _ex('Soulevé de terre roumain'), 3, '15-20', 45, 0),
  (_td('Muscular Endurance','Conditioning'), _ex('Pompes'), 3, '15-20', 30, 1),
  (_td('Muscular Endurance','Conditioning'), _ex('Fentes haltères'), 3, '15-20', 30, 2),
  (_td('Muscular Endurance','Conditioning'), _ex('Rowing haltère'), 3, '15-20', 30, 3),
  (_td('Muscular Endurance','Conditioning'), _ex('Crunch assis machine'), 3, '15-20', 30, 4),
  (_td('Muscular Endurance','Conditioning'), _ex('Extension mollet machine'), 3, '20-25', 30, 5)
) AS v(template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM template_exercises LIMIT 1);

-- 5. Exercise alternatives
INSERT INTO exercise_alternatives (exercise_id, alternative_exercise_id, equipment_context) VALUES
  -- Home (bodyweight)
  (_ex('Développé couché'),           _ex('Pompes'), 'home'),
  (_ex('Papillon bras tendus'),       _ex('Pompes'), 'home'),
  (_ex('Pec Deck bras tendus'),       _ex('Pompes'), 'home'),
  (_ex('Tirage latéral prise large'), _ex('Tractions'), 'home'),
  (_ex('Rangées prise serrée neutre'),_ex('Tractions'), 'home'),
  (_ex('Rangées prise large pronation'),_ex('Tractions'), 'home'),
  (_ex('Extension triceps corde'),    _ex('Dips'), 'home'),
  (_ex('Skull Crusher incliné'),      _ex('Dips'), 'home'),
  (_ex('Crunch assis machine'),       _ex('Crunchs'), 'home'),
  (_ex('Crunch à genoux poulie'),     _ex('Crunchs'), 'home'),
  (_ex('Extension du dos machine'),   _ex('Gainage planche'), 'home'),
  (_ex('Presse à cuisse'),            _ex('Squat au poids du corps'), 'home'),
  (_ex('Extension de jambe machine'), _ex('Squat au poids du corps'), 'home'),
  (_ex('Élévation mollet machine'),   _ex('Élévation mollet debout'), 'home'),
  (_ex('Extension mollet machine'),   _ex('Élévation mollet debout'), 'home'),
  -- Minimal (dumbbells)
  (_ex('Développé couché'),           _ex('Développé haltères'), 'minimal'),
  (_ex('Papillon bras tendus'),       _ex('Développé haltères'), 'minimal'),
  (_ex('Pec Deck bras tendus'),       _ex('Développé haltères'), 'minimal'),
  (_ex('Tirage latéral prise large'), _ex('Rowing haltère'), 'minimal'),
  (_ex('Rangées prise serrée neutre'),_ex('Rowing haltère'), 'minimal'),
  (_ex('Rangées prise large pronation'),_ex('Rowing haltère'), 'minimal'),
  (_ex('Extension triceps corde'),    _ex('Extension triceps haltère'), 'minimal'),
  (_ex('Skull Crusher incliné'),      _ex('Extension triceps haltère'), 'minimal'),
  (_ex('Curls stricts barre'),        _ex('Curl marteau haltères'), 'minimal'),
  (_ex('Crunch assis machine'),       _ex('Crunchs'), 'minimal'),
  (_ex('Crunch à genoux poulie'),     _ex('Crunchs'), 'minimal'),
  (_ex('Extension du dos machine'),   _ex('Gainage planche'), 'minimal'),
  (_ex('Presse à cuisse'),            _ex('Fentes haltères'), 'minimal'),
  (_ex('Extension de jambe machine'), _ex('Fentes haltères'), 'minimal'),
  (_ex('Élévation mollet machine'),   _ex('Élévation mollet debout'), 'minimal'),
  (_ex('Extension mollet machine'),   _ex('Élévation mollet debout'), 'minimal')
ON CONFLICT (exercise_id, equipment_context) DO NOTHING;

-- Cleanup helper functions
DROP FUNCTION _td(text, text);
DROP FUNCTION _ex(text);

COMMIT;
