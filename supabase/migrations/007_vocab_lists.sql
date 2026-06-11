-- Vocab lists
-- User-defined lists for organizing study words (max 5 lists enforced in app for now)

CREATE TABLE lingoleaf.vocab_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Prevent duplicate list names per user (case-insensitive)
CREATE UNIQUE INDEX idx_vocab_lists_user_name_unique ON lingoleaf.vocab_lists(user_id, lower(name));
CREATE INDEX idx_vocab_lists_user_last_used ON lingoleaf.vocab_lists(user_id, last_used_at DESC NULLS LAST);
CREATE INDEX idx_vocab_lists_user_created ON lingoleaf.vocab_lists(user_id, created_at ASC);

ALTER TABLE lingoleaf.vocab_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vocab lists"
  ON lingoleaf.vocab_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vocab lists"
  ON lingoleaf.vocab_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocab lists"
  ON lingoleaf.vocab_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vocab lists"
  ON lingoleaf.vocab_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Link lingoleaf.study_words to a list; deleting a list deletes all its words
ALTER TABLE lingoleaf.study_words
  ADD COLUMN list_id UUID REFERENCES lingoleaf.vocab_lists(id) ON DELETE CASCADE;

CREATE INDEX idx_study_words_list ON lingoleaf.study_words(user_id, list_id, created_at DESC);

-- Allow the same term in different lists (update unique constraint to include list_id)
DROP INDEX IF EXISTS idx_study_words_unique;
CREATE UNIQUE INDEX idx_study_words_unique
  ON lingoleaf.study_words(user_id, book_id, source_lang, target_lang, term_normalized, list_id);


