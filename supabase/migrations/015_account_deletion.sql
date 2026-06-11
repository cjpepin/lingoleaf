-- Account deletion support
-- Add deleted_at column to auth.users metadata (via lingoleaf.user_settings proxy)
-- and create a helper function for soft-delete

-- Add deleted_at to lingoleaf.user_settings (our proxy for user metadata)
ALTER TABLE lingoleaf.user_settings
  ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for filtering out deleted users
CREATE INDEX idx_user_settings_deleted ON lingoleaf.user_settings(deleted_at) WHERE deleted_at IS NOT NULL;

-- Helper function to soft-delete a user account
-- This marks the user as deleted and signs them out
CREATE OR REPLACE FUNCTION lingoleaf.soft_delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark user as deleted in lingoleaf.user_settings
  INSERT INTO lingoleaf.user_settings (user_id, deleted_at, updated_at)
  VALUES (auth.uid(), NOW(), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    deleted_at = NOW(),
    updated_at = NOW();
    
  -- Note: We don't actually delete auth.users or user data here.
  -- This is a soft delete that allows for account recovery if needed.
  -- To hard-delete, you'd need to use Supabase dashboard or service role.
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION lingoleaf.soft_delete_user_account() TO authenticated;


