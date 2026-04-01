ALTER TABLE set_logs ADD COLUMN rest_seconds integer;

CREATE INDEX IF NOT EXISTS idx_set_logs_rest_seconds
  ON set_logs (rest_seconds) WHERE rest_seconds IS NOT NULL;
