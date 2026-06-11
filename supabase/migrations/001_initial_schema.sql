-- LingoLeaf Initial Schema
-- Creates all tables and RLS policies

-- Dedicated app schema (public is reserved for the root portfolio project).
create schema if not exists lingoleaf;

grant usage on schema lingoleaf to postgres, anon, authenticated, service_role;

alter default privileges in schema lingoleaf
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema lingoleaf
  grant all on sequences to anon, authenticated, service_role;

alter default privileges in schema lingoleaf
  grant all on functions to anon, authenticated, service_role;

-- Books table
CREATE TABLE lingoleaf.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT,
  storage_path TEXT NOT NULL,
  cover_path TEXT,
  source_lang TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Highlights table
CREATE TABLE lingoleaf.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES lingoleaf.books(id) ON DELETE CASCADE,
  cfi_range TEXT NOT NULL,
  selected_text TEXT NOT NULL,
  context_snippet TEXT,
  color TEXT DEFAULT 'mint',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for lingoleaf.highlights
CREATE INDEX idx_highlights_user_book ON lingoleaf.highlights(user_id, book_id);
CREATE UNIQUE INDEX idx_highlights_unique ON lingoleaf.highlights(user_id, book_id, cfi_range);

-- Study words table
CREATE TABLE lingoleaf.study_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES lingoleaf.books(id) ON DELETE CASCADE,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  term TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  translation TEXT NOT NULL,
  context_snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for lingoleaf.study_words
CREATE INDEX idx_study_words_user ON lingoleaf.study_words(user_id, created_at DESC);
CREATE INDEX idx_study_words_user_book ON lingoleaf.study_words(user_id, book_id);
CREATE UNIQUE INDEX idx_study_words_unique ON lingoleaf.study_words(user_id, book_id, source_lang, target_lang, term_normalized);

-- Translation cache table
CREATE TABLE lingoleaf.translation_cache (
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  translation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_lang, target_lang, term_normalized)
);

-- User settings table
CREATE TABLE lingoleaf.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lingoleaf.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingoleaf.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingoleaf.study_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingoleaf.translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingoleaf.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lingoleaf.books (readable by authenticated users)
CREATE POLICY "Books are viewable by authenticated users"
  ON lingoleaf.books FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for lingoleaf.highlights (user owns their data)
CREATE POLICY "Users can view their own highlights"
  ON lingoleaf.highlights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own highlights"
  ON lingoleaf.highlights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
  ON lingoleaf.highlights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for lingoleaf.study_words (user owns their data)
CREATE POLICY "Users can view their own study words"
  ON lingoleaf.study_words FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own study words"
  ON lingoleaf.study_words FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study words"
  ON lingoleaf.study_words FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for lingoleaf.user_settings
CREATE POLICY "Users can view their own settings"
  ON lingoleaf.user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON lingoleaf.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON lingoleaf.user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Translation cache is managed by Edge Function (service role only)
-- No policies needed for regular users

