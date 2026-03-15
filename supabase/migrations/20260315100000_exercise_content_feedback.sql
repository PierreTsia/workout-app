-- Table (idempotent — IF NOT EXISTS for fresh local dev, no-op in production)
CREATE TABLE IF NOT EXISTS exercise_content_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  user_email text NOT NULL,
  user_id uuid NOT NULL,
  source_screen text,
  fields_reported text[],
  error_details jsonb,
  other_illustration_text text,
  other_video_text text,
  other_description_text text,
  comment text,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_content_feedback ENABLE ROW LEVEL SECURITY;

-- INSERT policy: authenticated users can insert their own feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON exercise_content_feedback;
CREATE POLICY "Users can insert own feedback"
ON exercise_content_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- SELECT policy: admins can read all feedback
DROP POLICY IF EXISTS "Admins can read all feedback" ON exercise_content_feedback;
CREATE POLICY "Admins can read all feedback"
ON exercise_content_feedback FOR SELECT
USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'));

-- UPDATE policy: admins can update feedback status
DROP POLICY IF EXISTS "Admins can update feedback status" ON exercise_content_feedback;
CREATE POLICY "Admins can update feedback status"
ON exercise_content_feedback FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.jwt() ->> 'email'));
