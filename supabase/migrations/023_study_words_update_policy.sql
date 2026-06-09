-- Allow users to update their own study words (needed for starring/unstarring)
CREATE POLICY "Users can update their own study words"
  ON study_words FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
