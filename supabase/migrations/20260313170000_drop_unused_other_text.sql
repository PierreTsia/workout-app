-- Drop the unused generic other_text column (superseded by per-category other_*_text columns)
ALTER TABLE exercise_content_feedback
  DROP COLUMN IF EXISTS other_text;
