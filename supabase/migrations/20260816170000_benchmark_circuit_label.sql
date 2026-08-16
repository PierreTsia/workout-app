-- Give Benchmark Circuits an explicit display name (#480, T201).
-- Nullable until T202 inserts the Pantheon roster and tightens the constraint.

ALTER TABLE benchmark_circuits
  ADD COLUMN label text;

UPDATE benchmark_circuits
SET label = 'Cindy'
WHERE slug = 'cindy';
