-- Expand daily goal targets for reading/saved/learned in lingoleaf.user_settings

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name = 'daily_words_saved_goal'
  ) THEN
    ALTER TABLE lingoleaf.user_settings
      ADD COLUMN daily_words_saved_goal INTEGER NOT NULL DEFAULT 10;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name = 'daily_words_learned_goal'
  ) THEN
    ALTER TABLE lingoleaf.user_settings
      ADD COLUMN daily_words_learned_goal INTEGER NOT NULL DEFAULT 5;
  END IF;
END $$;

ALTER TABLE lingoleaf.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_daily_goal_minutes_check;

ALTER TABLE lingoleaf.user_settings
  ADD CONSTRAINT user_settings_daily_goal_minutes_check
  CHECK (
    daily_reading_goal_minutes BETWEEN 5 AND 60
    AND (daily_reading_goal_minutes % 5) = 0
  );

ALTER TABLE lingoleaf.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_daily_words_saved_goal_check;

ALTER TABLE lingoleaf.user_settings
  ADD CONSTRAINT user_settings_daily_words_saved_goal_check
  CHECK (
    daily_words_saved_goal BETWEEN 5 AND 50
    AND (daily_words_saved_goal % 5) = 0
  );

ALTER TABLE lingoleaf.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_daily_words_learned_goal_check;

ALTER TABLE lingoleaf.user_settings
  ADD CONSTRAINT user_settings_daily_words_learned_goal_check
  CHECK (daily_words_learned_goal BETWEEN 1 AND 15);

COMMENT ON COLUMN user_settings.daily_reading_goal_minutes IS 'Daily reading goal in minutes. Allowed values: 5..60 in steps of 5.';
COMMENT ON COLUMN user_settings.daily_words_saved_goal IS 'Daily words/phrases saved goal. Allowed values: 5..50 in steps of 5.';
COMMENT ON COLUMN user_settings.daily_words_learned_goal IS 'Daily words/phrases learned goal. Allowed values: 1..15.';
