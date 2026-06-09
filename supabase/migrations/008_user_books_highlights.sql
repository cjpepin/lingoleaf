-- user_books highlights
-- Store per-user per-book highlight metadata in a JSONB array.

ALTER TABLE user_books
  ADD COLUMN highlights JSONB NOT NULL DEFAULT '[]'::jsonb;


