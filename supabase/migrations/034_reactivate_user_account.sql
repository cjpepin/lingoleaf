-- Account reactivation helper
-- Reverses soft deletion by clearing user_settings.deleted_at for the current user.

CREATE OR REPLACE FUNCTION reactivate_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_settings (user_id, deleted_at, updated_at)
  VALUES (auth.uid(), NULL, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    deleted_at = NULL,
    updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION reactivate_user_account() TO authenticated;
