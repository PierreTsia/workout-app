-- =============================================
-- Achievement groups
-- =============================================
INSERT INTO achievement_groups (slug, name_fr, name_en, description_fr, description_en, metric_type, sort_order)
VALUES
  ('consistency_streak', 'Régularité',    'Consistency',       'Nombre total de séances terminées',           'Total finished workout sessions',              'session_count',         1),
  ('volume_king',        'Volume',         'Volume',            'Volume total soulevé (kg)',                    'Total volume lifted (kg)',                     'total_volume_kg',       2),
  ('rhythm_master',      'Rythme',         'Rhythm',            'Temps de repos respectés (≥ 80% du prescrit)','Rest times respected (≥ 80% of prescribed)',  'respected_rest_count',  3),
  ('record_hunter',      'Records',        'Records',           'Nombre de records personnels battus',         'Personal records broken',                      'pr_count',              4),
  ('exercise_variety',   'Variété',        'Variety',           'Nombre d''exercices distincts utilisés',       'Distinct exercises used',                      'unique_exercises',      5);

-- =============================================
-- Achievement tiers (5 ranks × 5 groups = 25)
-- icon_asset_url is NULL — populated in T54
-- =============================================

-- Consistency Streak
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'consistency_streak')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Apprenti Courbaturé',  'The Sore Apprentice',  5),
  ((SELECT id FROM g), 2, 'silver',   'Routine de Fer',       'Iron Routine',          25),
  ((SELECT id FROM g), 3, 'gold',     'Démon des Salles',     'Gym Demon',             50),
  ((SELECT id FROM g), 4, 'platinum', 'Machine de Guerre',    'War Machine',           100),
  ((SELECT id FROM g), 5, 'diamond',  'Légende de la Fonte',  'Legend of the Iron',    250);

-- Volume King
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'volume_king')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Sérieux, c''est tout ?', 'Is That All You Got?',  1000),
  ((SELECT id FROM g), 2, 'silver',   'Déménageur du dimanche', 'Sunday Mover',          10000),
  ((SELECT id FROM g), 3, 'gold',     'Titan du plateau',       'Plateau Titan',         50000),
  ((SELECT id FROM g), 4, 'platinum', 'Forgeron d''Acier',      'Steel Forger',          100000),
  ((SELECT id FROM g), 5, 'diamond',  'Dieu de l''Acier',       'God of Steel',          250000);

-- Rhythm Master
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'rhythm_master')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Impatience chronique', 'Chronic Impatience',  10),
  ((SELECT id FROM g), 2, 'silver',   'Pendule humaine',      'Human Pendulum',      50),
  ((SELECT id FROM g), 3, 'gold',     'Le Métronome',         'The Metronome',       150),
  ((SELECT id FROM g), 4, 'platinum', 'Horloge Suisse',       'Swiss Clockwork',     500),
  ((SELECT id FROM g), 5, 'diamond',  'Seigneur du Temps',    'Lord of Time',        1000);

-- Record Hunter
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'record_hunter')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Briseur de plafonds',  'Ceiling Breaker',    1),
  ((SELECT id FROM g), 2, 'silver',   'Chasseur de max',      'Max Hunter',         5),
  ((SELECT id FROM g), 3, 'gold',     'Destructeur de max',   'Max Destroyer',      15),
  ((SELECT id FROM g), 4, 'platinum', 'Fléau des records',    'Record Scourge',     30),
  ((SELECT id FROM g), 5, 'diamond',  'Divinité de l''Acier', 'Iron Deity',         50);

-- Exercise Variety
WITH g AS (SELECT id FROM achievement_groups WHERE slug = 'exercise_variety')
INSERT INTO achievement_tiers (group_id, tier_level, rank, title_fr, title_en, threshold_value)
VALUES
  ((SELECT id FROM g), 1, 'bronze',   'Curieux',              'The Curious One',   5),
  ((SELECT id FROM g), 2, 'silver',   'Explorateur',          'The Explorer',      10),
  ((SELECT id FROM g), 3, 'gold',     'Anatomiste',           'The Anatomist',     20),
  ((SELECT id FROM g), 4, 'platinum', 'Maître des Fibres',    'Fiber Master',      35),
  ((SELECT id FROM g), 5, 'diamond',  'Dr. Frankenstein',     'Dr. Frankenstein',  50);
