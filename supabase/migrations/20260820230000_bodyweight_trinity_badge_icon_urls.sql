-- Wire production badge-icon WebP URLs for the 5 Bodyweight Trinity tracks
-- (#509 / T223). Storage objects already live in the public `badge-icons`
-- bucket (flat naming, same as circuit tracks). Seed migration
-- 20260820220000 left icon_asset_url NULL on purpose.
-- Does not replace RPC bodies.

UPDATE achievement_tiers AS t
SET icon_asset_url = format(
  'https://favusepjqwpcroiolvaz.supabase.co/storage/v1/object/public/badge-icons/%s_%s.webp',
  g.slug,
  t.rank
)
FROM achievement_groups AS g
WHERE t.group_id = g.id
  AND g.slug IN (
    'push_ups',
    'pull_ups',
    'bw_squats',
    'bw_expert',
    'hundred_a_day'
  );
