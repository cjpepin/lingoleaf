-- Guest-first security hardening
-- Tighten admin/library write policies so anonymous (guest) users cannot modify global content.
-- Also add missing WITH CHECK clauses on UPDATE policies to prevent changing user_id ownership.

-- Admin flag is required by policies below (also reinforced in 024_add_admin_and_global_library.sql).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'lingoleaf'
      AND table_name = 'user_settings'
      AND column_name = 'admin'
  ) THEN
    ALTER TABLE lingoleaf.user_settings ADD COLUMN admin BOOLEAN DEFAULT false;
  END IF;
END $$;

UPDATE lingoleaf.user_settings
SET admin = COALESCE(admin, false)
WHERE admin IS NULL;

-- -----------------------------
-- lingoleaf.books: lock writes to admins
-- -----------------------------

DROP POLICY IF EXISTS "Authenticated users can insert books" ON lingoleaf.books;
DROP POLICY IF EXISTS "Authenticated users can update books" ON lingoleaf.books;
DROP POLICY IF EXISTS "Authenticated users can delete books" ON lingoleaf.books;

CREATE POLICY "Admins can insert books"
  ON lingoleaf.books FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  );

CREATE POLICY "Admins can update books"
  ON lingoleaf.books FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  );

CREATE POLICY "Admins can delete books"
  ON lingoleaf.books FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  );

-- --------------------------------------------
-- storage.objects: lock general-library writes
-- --------------------------------------------

-- Remove overly-broad policies (these allow any guest to upload/overwrite/delete library files)
DROP POLICY IF EXISTS "Authenticated users can read books" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to general-library" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read from general-library" ON storage.objects;
DROP POLICY IF EXISTS "Public can read from general-library" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update general-library" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from general-library" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage books" ON storage.objects;

-- Read: allow authenticated (including anonymous guests) to download library content.
CREATE POLICY "Authenticated can read from general-library"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'general-library');

-- Write: admins only (used by Admin upload screen)
CREATE POLICY "Admins can upload to general-library"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'general-library'
    AND EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  );

CREATE POLICY "Admins can update general-library"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'general-library'
    AND EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  )
  WITH CHECK (
    bucket_id = 'general-library'
    AND EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  );

CREATE POLICY "Admins can delete from general-library"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'general-library'
    AND EXISTS (
      SELECT 1
      FROM lingoleaf.user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.admin = true
    )
  );

-- Service role: keep explicit policy (optional; service role typically bypasses RLS anyway)
CREATE POLICY "Service role can manage general-library"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'general-library');

-- ---------------------------------------------------------
-- lingoleaf.user_settings/lingoleaf.user_books: add WITH CHECK on UPDATE policies
-- ---------------------------------------------------------

DROP POLICY IF EXISTS "Users can update their own settings" ON lingoleaf.user_settings;
CREATE POLICY "Users can update their own settings"
  ON lingoleaf.user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own user_books" ON lingoleaf.user_books;
CREATE POLICY "Users can update their own user_books"
  ON lingoleaf.user_books FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


