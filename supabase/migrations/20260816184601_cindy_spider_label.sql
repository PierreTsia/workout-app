-- Editorial: Cindy's display name matches the Pantheon emoji contract.
-- GymLogic seed only. Slug stays `cindy`. Forks are untouched.

UPDATE benchmark_circuits
SET label = 'Cindy 🕷️'
WHERE slug = 'cindy'
  AND owner_id IS NULL
  AND label = 'Cindy';
