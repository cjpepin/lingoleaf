-- Auto-remove downloaded books not read in X days (0 = disabled)
-- Default 14 = remove local files for books not read in 2 weeks; metadata/progress kept in DB

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='auto_remove_downloads_after_days') THEN
    ALTER TABLE user_settings ADD COLUMN auto_remove_downloads_after_days INTEGER DEFAULT 14;
  END IF;
END $$;
