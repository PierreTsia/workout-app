-- Exercise content feedback: user reports for wrong description, video, or illustration
CREATE TABLE exercise_content_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  user_id uuid NOT NULL,
  source_screen text,
  fields_reported text[] NOT NULL DEFAULT '{}',
  error_details jsonb NOT NULL DEFAULT '{}',
  other_text text,
  comment text,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_content_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own feedback only
CREATE POLICY "Users can insert own feedback"
ON exercise_content_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- No SELECT/UPDATE/DELETE for regular users (future admin triage will use separate policy or service role)
