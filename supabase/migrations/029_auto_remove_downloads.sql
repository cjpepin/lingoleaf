-- Auto-remove downloaded lingoleaf.books not read in X days (0 = disabled)
-- Default 14 = remove local files for lingoleaf.books not read in 2 weeks; metadata/progress kept in DB

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name='auto_remove_downloads_after_days') THEN
    ALTER TABLE lingoleaf.user_settings ADD COLUMN auto_remove_downloads_after_days INTEGER DEFAULT 14;
  END IF;
END $$;
