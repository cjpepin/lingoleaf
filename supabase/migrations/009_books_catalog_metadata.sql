-- Extend books table with catalog metadata for large-scale ingestion (e.g., Gutendex)
-- US-first: store source attribution + language + subject metadata for filtering/search

-- Allow externally-hosted EPUBs (e.g., Project Gutenberg) by making storage_path nullable
ALTER TABLE books
  ALTER COLUMN storage_path DROP NOT NULL;

-- Source attribution (where the book record came from)
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS epub_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[],
  ADD COLUMN IF NOT EXISTS subjects TEXT[],
  ADD COLUMN IF NOT EXISTS bookshelves TEXT[],
  ADD COLUMN IF NOT EXISTS subjects_text TEXT;

-- Prevent duplicates for external catalogs (only when source_id is present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_source_source_id
  ON books(source, source_id)
  WHERE source_id IS NOT NULL;

-- Basic filtering helpers
CREATE INDEX IF NOT EXISTS idx_books_source ON books(source);
CREATE INDEX IF NOT EXISTS idx_books_source_lang ON books(source_lang);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);

-- Array filters (subjects/languages)
CREATE INDEX IF NOT EXISTS idx_books_subjects_gin ON books USING GIN (subjects);
CREATE INDEX IF NOT EXISTS idx_books_languages_gin ON books USING GIN (languages);


