-- Reader preferences in user_settings

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='reader_highlight_on_translate') THEN
    ALTER TABLE user_settings ADD COLUMN reader_highlight_on_translate BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='reader_font_size') THEN
    ALTER TABLE user_settings ADD COLUMN reader_font_size VARCHAR(20) DEFAULT '100%';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='reader_font_family') THEN
    ALTER TABLE user_settings ADD COLUMN reader_font_family VARCHAR(100) DEFAULT 'inherit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='reader_highlight_color') THEN
    ALTER TABLE user_settings ADD COLUMN reader_highlight_color VARCHAR(20) DEFAULT 'mint';
  END IF;
END $$;
