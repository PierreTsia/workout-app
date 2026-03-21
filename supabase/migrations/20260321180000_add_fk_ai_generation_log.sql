ALTER TABLE ai_generation_log
  ADD CONSTRAINT fk_ai_generation_log_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
