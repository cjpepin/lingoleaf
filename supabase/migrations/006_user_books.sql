-- User ↔ Books join table
-- Stores per-user metadata for each book (reading progress, future: download state, last opened, etc.)

CREATE TABLE user_books (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  last_cfi TEXT,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

CREATE INDEX idx_user_books_user_updated ON user_books(user_id, updated_at DESC);
CREATE INDEX idx_user_books_user_last_read ON user_books(user_id, last_read_at DESC);

ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own user_books"
  ON user_books FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own user_books"
  ON user_books FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own user_books"
  ON user_books FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);


