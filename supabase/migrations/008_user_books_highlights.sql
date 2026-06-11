-- lingoleaf.user_books lingoleaf.highlights
-- Store per-user per-book highlight metadata in a JSONB array.

ALTER TABLE lingoleaf.user_books
  ADD COLUMN highlights JSONB NOT NULL DEFAULT '[]'::jsonb;


