-- Theseus Héros Rx: 5/10/15 → 10/10/10 (same stations, flat amounts).
-- Seed story copy follows the numbers. Existing day snapshots / block_runs
-- keep their old fingerprint; only the catalog row + future instantiations change.

UPDATE benchmark_circuits
SET
  story_fr = 'Dix rowings inversés, dix dips banc, dix pompes. Le fil est là. Dix minutes pour le taureau, sans te perdre.',
  story_en = 'Ten inverted rows, ten bench dips, ten push-ups. The thread is in your hand. Ten minutes for the bull, don’t get lost.',
  rx = jsonb_set(
    jsonb_set(
      jsonb_set(
        rx,
        '{exercises,0,amount}',
        '10'::jsonb
      ),
      '{exercises,1,amount}',
      '10'::jsonb
    ),
    '{exercises,2,amount}',
    '10'::jsonb
  )
WHERE slug = 'theseus'
  AND owner_id IS NULL;
