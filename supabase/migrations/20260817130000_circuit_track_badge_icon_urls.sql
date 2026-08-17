-- Wire production badge-icon WebP URLs for the 5 circuit achievement tracks (#482).
-- Storage objects already live in the public `badge-icons` bucket (flat naming).
-- Seed migration 20260817120000 left icon_asset_url NULL on purpose.

UPDATE achievement_tiers AS t
SET icon_asset_url = format(
  'https://favusepjqwpcroiolvaz.supabase.co/storage/v1/object/public/badge-icons/%s_%s.webp',
  g.slug,
  t.rank
)
FROM achievement_groups AS g
WHERE t.group_id = g.id
  AND g.slug IN (
    'circuit_runner',
    'spidey',
    'olympians',
    'heroes',
    'pantheoniste'
  );
