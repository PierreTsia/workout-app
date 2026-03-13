-- Per-category "other" text so we know which clarification refers to illustration, video, or description
ALTER TABLE exercise_content_feedback
  ADD COLUMN IF NOT EXISTS other_illustration_text text,
  ADD COLUMN IF NOT EXISTS other_video_text text,
  ADD COLUMN IF NOT EXISTS other_description_text text;
