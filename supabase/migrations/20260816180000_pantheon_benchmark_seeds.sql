-- Expand the curated Benchmark Circuit catalog with the Pantheon roster (#480, T202).
-- Exact exercise names were locked against the production catalog before authoring.

INSERT INTO exercises (name, muscle_group, emoji, is_system, equipment, name_en) VALUES
  ('Burpee', 'Quadriceps', '🦵', true, 'bodyweight', 'Burpee'),
  ('Squats sautés', 'Quadriceps', '🦵', true, 'bodyweight', 'Squat Jump'),
  ('Pompes', 'Pectoraux', '🏋️', true, 'bodyweight', 'Push-Up'),
  ('Jumping jacks', 'Quadriceps', '🦵', true, 'bodyweight', 'Jumping Jacks'),
  ('Squat au poids du corps', 'Quadriceps', '🦵', true, 'bodyweight', 'Bodyweight Squat'),
  ('Pompes sur les genoux', 'Pectoraux', '🏋️', true, 'bodyweight', 'Knee Push-Up'),
  ('Tractions', 'Dos', '🚣', true, 'bodyweight', 'Pull-Up'),
  ('Dips', 'Pectoraux', '🏋️', true, 'bodyweight', 'Parallel Bar Dip'),
  ('Pompes prise serrée (Diamant)', 'Triceps', '💪', true, 'bodyweight', 'Diamond Push-Ups'),
  ('Rowing inversé (tractions australiennes)', 'Dos', '🚣', true, 'bodyweight', 'Inverted Row'),
  ('Dips sur banc au sol', 'Triceps', '💪', true, 'bench', 'Bench Dips (feet on floor)'),
  ('Bear walk', 'Abdos', '🔥', true, 'bodyweight', 'Bear Crawl'),
  ('Crunchs bicyclette', 'Abdos', '🔥', true, 'bodyweight', 'Bicycle Crunch'),
  ('Gainage shoulder tap', 'Abdos', '🔥', true, 'bodyweight', 'Plank Shoulder Tap'),
  ('Bird dog', 'Abdos', '🔥', true, 'bodyweight', 'Bird Dog'),
  ('Crunchs', 'Abdos', '🔥', true, 'bodyweight', 'Crunch'),
  ('Dead bug', 'Abdos', '🔥', true, 'bodyweight', 'Dead Bug'),
  ('Squat pistol box', 'Quadriceps', '🦵', true, 'bodyweight', 'Box Pistol Squat'),
  ('Fentes haltères', 'Quadriceps', '🦵', true, 'dumbbell', 'Dumbbell Lunge'),
  ('Pont fessier unipodal', 'Fessiers', '🍑', true, 'bodyweight', 'Single Leg Glute Bridge'),
  ('Montées de genoux avec skip', 'Quadriceps', '🦵', true, 'bodyweight', 'High Knee Skips'),
  ('Step Up', 'Quadriceps', '🦵', true, 'bodyweight', 'Step Up'),
  ('Pont fessier', 'Fessiers', '🍑', true, 'bodyweight', 'Glute Bridge')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  burpee_id uuid;
  jump_squat_id uuid;
  pushup_id uuid;
  jumping_jacks_id uuid;
  bodyweight_squat_id uuid;
  knee_pushup_id uuid;
  pullup_id uuid;
  dips_id uuid;
  diamond_pushup_id uuid;
  inverted_row_id uuid;
  bench_dips_id uuid;
  bear_walk_id uuid;
  bicycle_crunch_id uuid;
  shoulder_tap_id uuid;
  bird_dog_id uuid;
  crunch_id uuid;
  dead_bug_id uuid;
  box_pistol_id uuid;
  lunge_id uuid;
  single_leg_bridge_id uuid;
  high_knees_id uuid;
  step_up_id uuid;
  glute_bridge_id uuid;
BEGIN
  SELECT id INTO STRICT burpee_id FROM exercises WHERE name = 'Burpee';
  SELECT id INTO STRICT jump_squat_id FROM exercises WHERE name = 'Squats sautés';
  SELECT id INTO STRICT pushup_id FROM exercises WHERE name = 'Pompes';
  SELECT id INTO STRICT jumping_jacks_id FROM exercises WHERE name = 'Jumping jacks';
  SELECT id INTO STRICT bodyweight_squat_id FROM exercises WHERE name = 'Squat au poids du corps';
  SELECT id INTO STRICT knee_pushup_id FROM exercises WHERE name = 'Pompes sur les genoux';
  SELECT id INTO STRICT pullup_id FROM exercises WHERE name = 'Tractions';
  SELECT id INTO STRICT dips_id FROM exercises WHERE name = 'Dips';
  SELECT id INTO STRICT diamond_pushup_id FROM exercises WHERE name = 'Pompes prise serrée (Diamant)';
  SELECT id INTO STRICT inverted_row_id FROM exercises WHERE name = 'Rowing inversé (tractions australiennes)';
  SELECT id INTO STRICT bench_dips_id FROM exercises WHERE name = 'Dips sur banc au sol';
  SELECT id INTO STRICT bear_walk_id FROM exercises WHERE name = 'Bear walk';
  SELECT id INTO STRICT bicycle_crunch_id FROM exercises WHERE name = 'Crunchs bicyclette';
  SELECT id INTO STRICT shoulder_tap_id FROM exercises WHERE name = 'Gainage shoulder tap';
  SELECT id INTO STRICT bird_dog_id FROM exercises WHERE name = 'Bird dog';
  SELECT id INTO STRICT crunch_id FROM exercises WHERE name = 'Crunchs';
  SELECT id INTO STRICT dead_bug_id FROM exercises WHERE name = 'Dead bug';
  SELECT id INTO STRICT box_pistol_id FROM exercises WHERE name = 'Squat pistol box';
  SELECT id INTO STRICT lunge_id FROM exercises WHERE name = 'Fentes haltères';
  SELECT id INTO STRICT single_leg_bridge_id FROM exercises WHERE name = 'Pont fessier unipodal';
  SELECT id INTO STRICT high_knees_id FROM exercises WHERE name = 'Montées de genoux avec skip';
  SELECT id INTO STRICT step_up_id FROM exercises WHERE name = 'Step Up';
  SELECT id INTO STRICT glute_bridge_id FROM exercises WHERE name = 'Pont fessier';

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'zeus', NULL, ARRAY[]::text[], 'Zeus ⚡', 'Full body', 'Full body',
    'Cinq burpees, dix squats sautés, quinze pompes. Le roi ne pèse rien : il compte les tours. Vingt minutes sous l’orage.',
    'Five burpees, ten jump squats, fifteen push-ups. The king doesn’t weigh anything. He counts rounds. Twenty minutes under the storm.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 1200,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', burpee_id, 'amount', 5, 'weight', 0),
        jsonb_build_object('exercise_id', jump_squat_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', pushup_id, 'amount', 15, 'weight', 0)
      )
    )
  );

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'heracles', NULL, ARRAY['hercule', 'héraclès'], 'Heracles 🦁', 'Full body', 'Full body',
    'Vingt jumping jacks, dix squats, dix pompes genoux. Les travaux, version mortel. Dix minutes, tu sors, tu recommences.',
    'Twenty jumping jacks, ten squats, ten knee push-ups. The labors, mortal edition. Ten minutes, you walk out, you go again.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 600,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', jumping_jacks_id, 'amount', 20, 'weight', 0),
        jsonb_build_object('exercise_id', bodyweight_squat_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', knee_pushup_id, 'amount', 10, 'weight', 0)
      )
    )
  );

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'ares', NULL, ARRAY['arès'], 'Ares 🗡️', 'Force haut du corps', 'Upper-body strength',
    'Cinq tractions, dix dips, quinze diamants. Pas de traité. Les bras d’abord, la tête après.',
    'Five pull-ups, ten dips, fifteen diamonds. No treaty. Arms first, head later.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 1200,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', pullup_id, 'amount', 5, 'weight', 0),
        jsonb_build_object('exercise_id', dips_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', diamond_pushup_id, 'amount', 15, 'weight', 0)
      )
    )
  );

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'theseus', NULL, ARRAY['thésée'], 'Theseus 🐂', 'Force haut du corps', 'Upper-body strength',
    'Cinq rowings inversés, dix dips banc, quinze pompes. Le fil est là. Dix minutes pour le taureau, sans te perdre.',
    'Five inverted rows, ten bench dips, fifteen push-ups. The thread is in your hand. Ten minutes for the bull, don’t get lost.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 600,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', inverted_row_id, 'amount', 5, 'weight', 0),
        jsonb_build_object('exercise_id', bench_dips_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', pushup_id, 'amount', 15, 'weight', 0)
      )
    )
  );

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'athena', NULL, ARRAY['athéna'], 'Athena 🦉', 'Core', 'Core',
    'Vingt pas de bear walk, quinze bicyclettes, quinze shoulder taps. La sagesse, c’est le milieu qui ne lâche pas.',
    'Twenty bear-crawl steps, fifteen bicycles, fifteen shoulder taps. Wisdom is the middle that doesn’t leak.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 1200,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', bear_walk_id, 'amount', 20, 'weight', 0),
        jsonb_build_object('exercise_id', bicycle_crunch_id, 'amount', 15, 'weight', 0),
        jsonb_build_object('exercise_id', shoulder_tap_id, 'amount', 15, 'weight', 0)
      )
    )
  );

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'atlas', NULL, ARRAY[]::text[], 'Atlas 🌍', 'Core', 'Core',
    'Dix bird dogs, quinze crunches, dix dead bugs. Tu ne portes pas le ciel. Tu apprends à ne pas le poser.',
    'Ten bird dogs, fifteen crunches, ten dead bugs. You’re not holding the sky. You’re learning not to set it down.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 600,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', bird_dog_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', crunch_id, 'amount', 15, 'weight', 0),
        jsonb_build_object('exercise_id', dead_bug_id, 'amount', 10, 'weight', 0)
      )
    )
  );

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'hades', NULL, ARRAY['hadès'], 'Hades 🌑', 'Jambes', 'Legs',
    'Cinq pistols box, dix fentes, quinze ponts unipodaux. On ne sprint pas Hadès. On descend.',
    'Five box pistols, ten lunges, fifteen single-leg glute bridges. You don’t sprint Hades. You go down.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 1200,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', box_pistol_id, 'amount', 5, 'weight', 0),
        jsonb_build_object('exercise_id', lunge_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', single_leg_bridge_id, 'amount', 15, 'weight', 0)
      )
    )
  );

  INSERT INTO benchmark_circuits (
    slug, owner_id, aliases, label, tagline_fr, tagline_en,
    story_fr, story_en, reference, rx
  ) VALUES (
    'achilles', NULL, ARRAY['achille'], 'Achilles 🛡️', 'Jambes', 'Legs',
    'Vingt montées de genoux, dix step-ups, quinze ponts. Pied léger, pas le grind d’en bas. Dix minutes — cours.',
    'Twenty high knees, ten step-ups, fifteen glute bridges. Light foot, none of the grind below. Ten minutes — run.',
    NULL,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 600,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', high_knees_id, 'amount', 20, 'weight', 0),
        jsonb_build_object('exercise_id', step_up_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', glute_bridge_id, 'amount', 15, 'weight', 0)
      )
    )
  );
END $$;

ALTER TABLE benchmark_circuits
  ALTER COLUMN label SET NOT NULL;
