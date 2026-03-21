-- Per-source AI generation quota (program vs quick workout)

ALTER TABLE ai_generation_log
  ADD COLUMN source text NOT NULL DEFAULT 'program';

ALTER TABLE ai_generation_log
  ADD CONSTRAINT chk_ai_generation_log_source
  CHECK (source IN ('program', 'workout'));

DROP INDEX IF EXISTS idx_ai_generation_log_user_window;

CREATE INDEX idx_ai_generation_log_user_source_window
  ON ai_generation_log (user_id, source, created_at DESC);
