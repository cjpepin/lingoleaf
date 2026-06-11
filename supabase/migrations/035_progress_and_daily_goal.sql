-- Progress + daily reading goals

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name = 'daily_reading_goal_minutes'
  ) THEN
    ALTER TABLE lingoleaf.user_settings
      ADD COLUMN daily_reading_goal_minutes INTEGER NOT NULL DEFAULT 10;
  END IF;
END $$;

ALTER TABLE lingoleaf.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_daily_goal_minutes_check;

ALTER TABLE lingoleaf.user_settings
  ADD CONSTRAINT user_settings_daily_goal_minutes_check
  CHECK (daily_reading_goal_minutes IN (5, 10, 15));

CREATE TABLE IF NOT EXISTS lingoleaf.reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  book_id TEXT,
  book_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_started
  ON lingoleaf.reading_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS lingoleaf.vocab_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocab_id TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocab_reviews_user_reviewed
  ON lingoleaf.vocab_reviews(user_id, reviewed_at DESC);

ALTER TABLE lingoleaf.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingoleaf.vocab_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own reading_sessions" ON lingoleaf.reading_sessions;
CREATE POLICY "Users can read their own reading_sessions"
  ON lingoleaf.reading_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own reading_sessions" ON lingoleaf.reading_sessions;
CREATE POLICY "Users can insert their own reading_sessions"
  ON lingoleaf.reading_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own reading_sessions" ON lingoleaf.reading_sessions;
CREATE POLICY "Users can update their own reading_sessions"
  ON lingoleaf.reading_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own reading_sessions" ON lingoleaf.reading_sessions;
CREATE POLICY "Users can delete their own reading_sessions"
  ON lingoleaf.reading_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read their own vocab_reviews" ON lingoleaf.vocab_reviews;
CREATE POLICY "Users can read their own vocab_reviews"
  ON lingoleaf.vocab_reviews FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own vocab_reviews" ON lingoleaf.vocab_reviews;
CREATE POLICY "Users can insert their own vocab_reviews"
  ON lingoleaf.vocab_reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own vocab_reviews" ON lingoleaf.vocab_reviews;
CREATE POLICY "Users can update their own vocab_reviews"
  ON lingoleaf.vocab_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own vocab_reviews" ON lingoleaf.vocab_reviews;
CREATE POLICY "Users can delete their own vocab_reviews"
  ON lingoleaf.vocab_reviews FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON COLUMN user_settings.daily_reading_goal_minutes IS 'Daily reading goal in minutes. Allowed values: 5, 10, 15.';
COMMENT ON TABLE lingoleaf.reading_sessions IS 'Per-reading session records used for progress and goal tracking.';
COMMENT ON TABLE lingoleaf.vocab_reviews IS 'Review event log for study words used in progress aggregates.';
