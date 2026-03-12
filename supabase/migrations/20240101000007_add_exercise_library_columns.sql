ALTER TABLE exercises ADD COLUMN equipment text NOT NULL DEFAULT 'bodyweight';
ALTER TABLE exercises ADD COLUMN name_en text;
ALTER TABLE exercises ADD COLUMN source text;
ALTER TABLE exercises ADD COLUMN secondary_muscles text[];
