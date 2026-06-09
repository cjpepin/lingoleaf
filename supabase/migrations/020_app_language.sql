-- App UI language preference in user_settings

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='app_lang') THEN
    ALTER TABLE user_settings ADD COLUMN app_lang TEXT DEFAULT 'en';
  END IF;
END $$;
