-- Starred flag for study words (study by starred / unstarred)
ALTER TABLE study_words
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_study_words_starred ON study_words(user_id, list_id, starred) WHERE starred = true;
