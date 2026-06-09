-- Add status to user_books: 'reading' (default), 'saved_for_later', or 'completed'
-- Allows "save for later" and separate History sections.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_books' AND column_name = 'status'
  ) THEN
    ALTER TABLE user_books
      ADD COLUMN status TEXT NOT NULL DEFAULT 'reading'
        CHECK (status IN ('reading', 'saved_for_later', 'completed'));
  END IF;
END $$;

COMMENT ON COLUMN user_books.status IS 'reading = in progress / recently read; saved_for_later = saved to read later; completed = finished';
