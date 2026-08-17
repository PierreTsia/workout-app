-- #482 post-migrate runbook:
-- After applying the #482 migration (circuit achievement tracks + RPC metrics),
-- run this script once against the target DB (Supabase SQL Editor / service role).
-- Idempotent: ON CONFLICT DO NOTHING inside the RPC means re-running is safe.
-- Grants are silent user_achievements inserts — overlay is not required for
-- catch-up (Realtime gate skips old grants). Optional: next session finish still
-- runs check_and_grant for overlay of any remaining tiers.
SELECT up.user_id, a.*
FROM user_profiles up
CROSS JOIN LATERAL check_and_grant_achievements(up.user_id) AS a;
