-- Idempotency for transactional email (welcome + future feedback kinds)
CREATE TABLE transactional_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_kind text NOT NULL CHECK (email_kind IN ('welcome', 'feedback_ack', 'feedback_resolved')),
  feedback_id uuid REFERENCES exercise_content_feedback(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  provider_id text
);

CREATE UNIQUE INDEX transactional_email_log_welcome_unique
  ON transactional_email_log (user_id) WHERE email_kind = 'welcome';

CREATE UNIQUE INDEX transactional_email_log_feedback_ack_unique
  ON transactional_email_log (feedback_id) WHERE email_kind = 'feedback_ack';

CREATE UNIQUE INDEX transactional_email_log_feedback_resolved_unique
  ON transactional_email_log (feedback_id) WHERE email_kind = 'feedback_resolved';

ALTER TABLE transactional_email_log ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (Edge Functions) accesses this table via PostgREST bypass

CREATE TABLE user_email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_notifications boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email preferences"
  ON user_email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own email preferences"
  ON user_email_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own email preferences"
  ON user_email_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_email_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_email_preferences_updated_at
  BEFORE UPDATE ON user_email_preferences
  FOR EACH ROW
  EXECUTE PROCEDURE update_user_email_preferences_updated_at();
