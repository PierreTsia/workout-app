ALTER TABLE user_profiles
  ADD COLUMN active_title_tier_id uuid
  REFERENCES achievement_tiers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION validate_title_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active_title_tier_id IS DISTINCT FROM OLD.active_title_tier_id
     AND NEW.active_title_tier_id IS NOT NULL
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_achievements
      WHERE user_id = NEW.user_id AND tier_id = NEW.active_title_tier_id
    ) THEN
      RAISE EXCEPTION 'User does not own this achievement tier'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_title_ownership
  BEFORE UPDATE OF active_title_tier_id ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_title_ownership();
