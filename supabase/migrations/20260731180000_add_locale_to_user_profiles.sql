-- Seeds the Display Locale on a device that has never stored one (T152, #422).
--
-- Nullable with no default on purpose: NULL means "never expressed a choice",
-- which is not the same as "chose French". A DEFAULT 'fr' would erase that
-- distinction and flip English speakers who never asked for anything.
--
-- Inline CHECK mirrors `gender`; vocabulary matches `embedded_agent_threads.locale`.
-- No RLS change needed — "Users manage own profile" is FOR ALL.
ALTER TABLE user_profiles
  ADD COLUMN locale text CHECK (locale IN ('en', 'fr'));

COMMENT ON COLUMN user_profiles.locale IS
  'Display Locale preference. NULL = never chosen. localStorage stays authoritative at render; this only seeds a new device.';
