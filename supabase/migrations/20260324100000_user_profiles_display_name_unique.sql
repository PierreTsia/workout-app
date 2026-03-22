-- Case-insensitive unique public moniker (multiple NULL / empty allowed).
-- If this migration fails, dedupe lower(btrim(display_name)) in user_profiles first.
CREATE UNIQUE INDEX user_profiles_display_name_lower_unique
ON user_profiles (lower(btrim(display_name)))
WHERE display_name IS NOT NULL AND btrim(display_name) <> '';
