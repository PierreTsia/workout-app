-- Run manually via Supabase SQL Editor AFTER deploying achievement migrations.
-- Idempotent: ON CONFLICT DO NOTHING inside the RPC means re-running is safe.
-- Badges are granted silently (no overlay) — they appear in the BadgeGrid on next load.
SELECT up.user_id, a.*
FROM user_profiles up
CROSS JOIN LATERAL check_and_grant_achievements(up.user_id) AS a;
