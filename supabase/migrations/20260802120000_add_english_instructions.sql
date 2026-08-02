-- English exercise instructions (T156, #417).
--
-- Nullable with no default on purpose: NULL on the status means "never
-- translated", which is not the same as "translated and clean". A DEFAULT would
-- erase that distinction, exactly as it would have on `user_profiles.locale`.
--
-- No RLS change needed — the new columns inherit the policies of
-- `20260313140002_exercises_rls.sql`. A NULL status passes the CHECK, since
-- `NULL IN (...)` is NULL, not false.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en jsonb;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en_status text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en_reviewed_at timestamptz;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en_audit jsonb;

ALTER TABLE exercises
  ADD CONSTRAINT exercises_instructions_en_status_chk
  CHECK (instructions_en_status IN ('clean', 'flagged', 'approved'));

COMMENT ON COLUMN exercises.instructions_en IS
  'English translation of `instructions`, same shape. Written whole or not at all.';

COMMENT ON COLUMN exercises.instructions_en_status IS
  'clean | flagged | approved. NULL = never translated. The only column read at render: anything but clean/approved shows French.';

COMMENT ON COLUMN exercises.instructions_en_reviewed_at IS
  'Human review of the translation. Deliberately not `reviewed_at`, which drives the content-review queue.';

COMMENT ON COLUMN exercises.instructions_en_audit IS
  'Translator/checker trace for the review screen. Never read at render.';
