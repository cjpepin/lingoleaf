-- [2026-03-04] [DB] Add primary-goal hierarchy + local reminder preferences to user_settings

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'primary_goal'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN primary_goal TEXT NOT NULL DEFAULT 'reading_minutes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'goal_priority'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN goal_priority TEXT[] NOT NULL DEFAULT ARRAY['reading_minutes','words_saved','words_learned'];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'daily_goal_reminder_enabled'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN daily_goal_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'daily_goal_reminder_hour'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN daily_goal_reminder_hour INTEGER NOT NULL DEFAULT 20;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'daily_goal_reminder_minute'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN daily_goal_reminder_minute INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_primary_goal_check;
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_primary_goal_check
  CHECK (primary_goal IN ('reading_minutes', 'words_saved', 'words_learned'));

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_goal_priority_check;
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_goal_priority_check
  CHECK (
    goal_priority <@ ARRAY['reading_minutes','words_saved','words_learned']::text[]
  );

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_daily_goal_reminder_hour_check;
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_daily_goal_reminder_hour_check
  CHECK (daily_goal_reminder_hour BETWEEN 0 AND 23);

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_daily_goal_reminder_minute_check;
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_daily_goal_reminder_minute_check
  CHECK (daily_goal_reminder_minute BETWEEN 0 AND 59);

COMMENT ON COLUMN user_settings.primary_goal IS 'Primary goal for garden health: reading_minutes|words_saved|words_learned.';
COMMENT ON COLUMN user_settings.goal_priority IS 'Ordered selected goals from onboarding/profile hierarchy.';
COMMENT ON COLUMN user_settings.daily_goal_reminder_enabled IS 'Whether daily goal reminder notification is enabled.';
COMMENT ON COLUMN user_settings.daily_goal_reminder_hour IS 'Local hour (0-23) for daily reminder.';
COMMENT ON COLUMN user_settings.daily_goal_reminder_minute IS 'Local minute (0-59) for daily reminder.';
