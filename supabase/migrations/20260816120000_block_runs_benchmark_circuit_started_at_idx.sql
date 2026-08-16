-- History sheet / MCP history filter block_runs by catalog id and order by
-- started_at. Partial: jetable runs (null catalog id) stay off the index.

CREATE INDEX idx_block_runs_benchmark_circuit_started_at
  ON block_runs (benchmark_circuit_id, started_at DESC)
  WHERE benchmark_circuit_id IS NOT NULL;
