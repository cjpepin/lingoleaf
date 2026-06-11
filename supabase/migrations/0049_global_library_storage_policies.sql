-- Storage policies for general-library bucket
-- Replaces 004_global_library_storage_policies.sql (duplicate version "004" fix).
-- Idempotent so re-push is safe if policies were created before schema_migrations insert failed.

DROP POLICY IF EXISTS "Authenticated users can upload to general-library" ON storage.objects;
CREATE POLICY "Authenticated users can upload to general-library"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'general-library');

DROP POLICY IF EXISTS "Authenticated users can read from general-library" ON storage.objects;
CREATE POLICY "Authenticated users can read from general-library"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'general-library');

DROP POLICY IF EXISTS "Public can read from general-library" ON storage.objects;
CREATE POLICY "Public can read from general-library"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'general-library');

DROP POLICY IF EXISTS "Authenticated users can update general-library" ON storage.objects;
CREATE POLICY "Authenticated users can update general-library"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'general-library')
WITH CHECK (bucket_id = 'general-library');

DROP POLICY IF EXISTS "Authenticated users can delete from general-library" ON storage.objects;
CREATE POLICY "Authenticated users can delete from general-library"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'general-library');
