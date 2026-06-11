-- Add language preference columns to lingoleaf.user_settings (idempotent; safe if 003 already applied)
-- Run this directly in Supabase SQL Editor

-- Check if columns already exist before adding
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name='native_lang') THEN
    ALTER TABLE lingoleaf.user_settings ADD COLUMN native_lang VARCHAR(10) DEFAULT 'en';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name='known_langs') THEN
    ALTER TABLE lingoleaf.user_settings ADD COLUMN known_langs TEXT[] DEFAULT ARRAY['en'];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name='goal_langs') THEN
    ALTER TABLE lingoleaf.user_settings ADD COLUMN goal_langs TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Update existing rows to have default values
UPDATE lingoleaf.user_settings
SET 
  native_lang = COALESCE(native_lang, 'en'),
  known_langs = COALESCE(known_langs, ARRAY['en']),
  goal_langs = COALESCE(goal_langs, ARRAY[]::TEXT[])
WHERE native_lang IS NULL OR known_langs IS NULL OR goal_langs IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.native_lang IS 'User''s native language (ISO 639-1 code)';
COMMENT ON COLUMN user_settings.known_langs IS 'Languages the user already knows (ISO 639-1 codes)';
COMMENT ON COLUMN user_settings.goal_langs IS 'Languages the user wants to learn (ISO 639-1 codes)';
