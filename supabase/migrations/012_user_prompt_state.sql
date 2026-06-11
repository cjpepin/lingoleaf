-- Track upgrade prompt state so we don't nag users.

CREATE TABLE IF NOT EXISTS lingoleaf.user_prompt_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_upgrade_prompt_at TIMESTAMPTZ,
  upgrade_prompt_dismiss_count INT NOT NULL DEFAULT 0,
  upgrade_prompt_last_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lingoleaf.user_prompt_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompt state"
  ON lingoleaf.user_prompt_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own prompt state"
  ON lingoleaf.user_prompt_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompt state"
  ON lingoleaf.user_prompt_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


