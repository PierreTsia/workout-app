-- Deduplicate set_logs: keep only the most recent entry (by logged_at)
-- per (session_id, exercise_id, set_number).
DELETE FROM set_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (session_id, exercise_id, set_number) id
  FROM set_logs
  ORDER BY session_id, exercise_id, set_number, logged_at DESC
);

-- Prevent future duplicates at the DB level.
ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_session_exercise_set_uniq
  UNIQUE (session_id, exercise_id, set_number);
