-- Add rate-limit columns for translation API
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS translate_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS translate_window_start timestamptz;
