-- App UI language preference in lingoleaf.user_settings

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name='app_lang') THEN
    ALTER TABLE lingoleaf.user_settings ADD COLUMN app_lang TEXT DEFAULT 'en';
  END IF;
END $$;
