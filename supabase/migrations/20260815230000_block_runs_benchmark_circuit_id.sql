-- GO snapshot of catalog identity on Block Runs (#398, T193).
-- Copied from exercise_blocks at stampGo; later Circuit Fork retargets
-- must not rewrite Monday's row. Null = jetable AMRAP.

ALTER TABLE block_runs
  ADD COLUMN benchmark_circuit_id uuid
    REFERENCES benchmark_circuits (id) ON DELETE SET NULL;
