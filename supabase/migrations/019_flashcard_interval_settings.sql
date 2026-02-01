-- Flashcard interval settings in user_settings
-- Again: within N cards (immediate); Hard/Good/Easy: minutes until next review

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='flashcard_again_cards') THEN
    ALTER TABLE user_settings ADD COLUMN flashcard_again_cards INTEGER DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='flashcard_interval_hard_min') THEN
    ALTER TABLE user_settings ADD COLUMN flashcard_interval_hard_min INTEGER DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='flashcard_interval_good_min') THEN
    ALTER TABLE user_settings ADD COLUMN flashcard_interval_good_min INTEGER DEFAULT 1440;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='flashcard_interval_easy_min') THEN
    ALTER TABLE user_settings ADD COLUMN flashcard_interval_easy_min INTEGER DEFAULT 4320;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='flashcard_interval_multiplier') THEN
    ALTER TABLE user_settings ADD COLUMN flashcard_interval_multiplier REAL DEFAULT 2;
  END IF;
END $$;
