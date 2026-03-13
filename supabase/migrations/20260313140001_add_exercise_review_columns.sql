ALTER TABLE exercises ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS reviewed_by text;
