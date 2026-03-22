-- Default public moniker to auth email (unique per user) when unset.
UPDATE user_profiles up
SET display_name = au.email
FROM auth.users au
WHERE up.user_id = au.id
  AND (up.display_name IS NULL OR btrim(up.display_name) = '')
  AND au.email IS NOT NULL
  AND btrim(au.email) <> '';
