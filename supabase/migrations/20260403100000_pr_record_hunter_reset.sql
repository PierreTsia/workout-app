-- PR detection overhaul (#175): remove Record Hunter grants so they can be recomputed
-- after running `npx tsx scripts/backfill-was-pr.ts` against production.
--
-- Post backfill, re-grant for all users (SQL editor, service role / postgres):
--   SELECT check_and_grant_achievements(u.id) FROM auth.users u;

DELETE FROM user_achievements
WHERE tier_id IN (
  SELECT at.id
  FROM achievement_tiers at
  JOIN achievement_groups ag ON ag.id = at.group_id
  WHERE ag.slug = 'record_hunter'
);
