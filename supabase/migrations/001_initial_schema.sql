-- LinguaLeaf Initial Schema
-- Creates all tables and RLS policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT,
  storage_path TEXT NOT NULL,
  cover_path TEXT,
  source_lang TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Highlights table
CREATE TABLE highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  cfi_range TEXT NOT NULL,
  selected_text TEXT NOT NULL,
  context_snippet TEXT,
  color TEXT DEFAULT 'mint',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for highlights
CREATE INDEX idx_highlights_user_book ON highlights(user_id, book_id);
CREATE UNIQUE INDEX idx_highlights_unique ON highlights(user_id, book_id, cfi_range);

-- Study words table
CREATE TABLE study_words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  term TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  translation TEXT NOT NULL,
  context_snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for study_words
CREATE INDEX idx_study_words_user ON study_words(user_id, created_at DESC);
CREATE INDEX idx_study_words_user_book ON study_words(user_id, book_id);
CREATE UNIQUE INDEX idx_study_words_unique ON study_words(user_id, book_id, source_lang, target_lang, term_normalized);

-- Translation cache table
CREATE TABLE translation_cache (
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  translation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_lang, target_lang, term_normalized)
);

-- User settings table
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for books (readable by authenticated users)
CREATE POLICY "Books are viewable by authenticated users"
  ON books FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for highlights (user owns their data)
CREATE POLICY "Users can view their own highlights"
  ON highlights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own highlights"
  ON highlights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
  ON highlights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for study_words (user owns their data)
CREATE POLICY "Users can view their own study words"
  ON study_words FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own study words"
  ON study_words FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study words"
  ON study_words FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_settings
CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Translation cache is managed by Edge Function (service role only)
-- No policies needed for regular users

