-- Spaced repetition / Anki-style retention for study words
-- Cascade delete when study word is deleted

CREATE TABLE study_word_reviews (
  study_word_id UUID PRIMARY KEY REFERENCES study_words(id) ON DELETE CASCADE,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interval_minutes INTEGER NOT NULL DEFAULT 15,
  last_rating TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_word_reviews_next ON study_word_reviews(next_review_at);
ALTER TABLE study_word_reviews ENABLE ROW LEVEL SECURITY;

-- Users can only access reviews for their own study words (via study_words join)
CREATE POLICY "Users can view their own study word reviews"
  ON study_word_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_words sw
      WHERE sw.id = study_word_reviews.study_word_id
      AND sw.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own study word reviews"
  ON study_word_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_words sw
      WHERE sw.id = study_word_reviews.study_word_id
      AND sw.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own study word reviews"
  ON study_word_reviews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_words sw
      WHERE sw.id = study_word_reviews.study_word_id
      AND sw.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own study word reviews"
  ON study_word_reviews FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_words sw
      WHERE sw.id = study_word_reviews.study_word_id
      AND sw.user_id = auth.uid()
    )
  );
