-- Premium entitlement flags on lingoleaf.user_settings (project uses lingoleaf.user_settings as per-user profile row)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings'
      AND column_name = 'is_premium'
  ) THEN
    ALTER TABLE lingoleaf.user_settings
      ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings'
      AND column_name = 'premium_plan'
  ) THEN
    ALTER TABLE lingoleaf.user_settings
      ADD COLUMN premium_plan TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings'
      AND column_name = 'premium_updated_at'
  ) THEN
    ALTER TABLE lingoleaf.user_settings
      ADD COLUMN premium_updated_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_settings_is_premium
  ON lingoleaf.user_settings(is_premium)
  WHERE is_premium = true;

COMMENT ON COLUMN user_settings.is_premium IS 'Premium entitlement flag for the signed-in user';
COMMENT ON COLUMN user_settings.premium_plan IS 'Premium plan code: monthly | yearly | lifetime';
COMMENT ON COLUMN user_settings.premium_updated_at IS 'Last entitlement update timestamp';
