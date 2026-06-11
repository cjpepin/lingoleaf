-- Fix Gutendex upsert: Postgres ON CONFLICT needs a non-partial unique constraint/index
-- The previous partial unique index (WHERE source_id IS NOT NULL) cannot be used for conflict inference.

DROP INDEX IF EXISTS idx_books_source_source_id;

-- Unique across external catalogs:
-- - Allows multiple rows with NULL source_id (Postgres treats NULLs as distinct)
-- - Enables upsert(onConflict: 'source,source_id')
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_source_source_id_unique
  ON lingoleaf.books(source, source_id);


