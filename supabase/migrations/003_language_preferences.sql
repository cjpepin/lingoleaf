-- Add language preference columns to lingoleaf.user_settings
-- Supports multiple known and goal languages

ALTER TABLE lingoleaf.user_settings
  ADD COLUMN native_lang VARCHAR(10) DEFAULT 'en',
  ADD COLUMN known_langs TEXT[] DEFAULT ARRAY['en'],
  ADD COLUMN goal_langs TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update existing rows to have default values
UPDATE lingoleaf.user_settings
SET 
  native_lang = 'en',
  known_langs = ARRAY['en'],
  goal_langs = ARRAY[]::TEXT[]
WHERE native_lang IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.native_lang IS 'User''s native language (ISO 639-1 code)';
COMMENT ON COLUMN user_settings.known_langs IS 'Languages the user already knows (ISO 639-1 codes)';
COMMENT ON COLUMN user_settings.goal_langs IS 'Languages the user wants to learn (ISO 639-1 codes)';

