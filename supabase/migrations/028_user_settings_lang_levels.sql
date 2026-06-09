-- Add fluency/level for known and goal languages (e.g. native, fluent, C1)
-- known_lang_levels: { "en": "native", "zh": "fluent" }
-- goal_lang_levels: { "es": "C1" }

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'known_lang_levels'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN known_lang_levels JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'goal_lang_levels'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN goal_lang_levels JSONB DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN user_settings.known_lang_levels IS 'Fluency per known language: native, fluent, advanced, intermediate, beginner';
COMMENT ON COLUMN user_settings.goal_lang_levels IS 'CEFR level per goal language: A1, A2, B1, B2, C1, C2';
