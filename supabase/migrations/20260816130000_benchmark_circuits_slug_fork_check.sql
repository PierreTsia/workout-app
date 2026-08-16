-- Tighten catalog identity: GymLogic seeds have a non-empty slug and no
-- forked_from; private rows are forks (owner + forked_from, no slug).
-- Resolve already lowercases keys — do not freeze slug case in CHECK.

ALTER TABLE benchmark_circuits
  DROP CONSTRAINT benchmark_circuits_slug_owner;

ALTER TABLE benchmark_circuits
  ADD CONSTRAINT benchmark_circuits_slug_owner CHECK (
    (
      owner_id IS NULL
      AND slug IS NOT NULL
      AND length(btrim(slug)) > 0
      AND forked_from IS NULL
    )
    OR (
      owner_id IS NOT NULL
      AND slug IS NULL
      AND forked_from IS NOT NULL
    )
  );
