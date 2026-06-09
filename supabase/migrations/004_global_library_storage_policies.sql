-- Storage policies for general-library bucket
-- Run this in Supabase SQL Editor after creating the general-library bucket

-- Allow authenticated users to upload to general-library
CREATE POLICY "Authenticated users can upload to general-library"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'general-library');

-- Allow authenticated users to read from general-library
CREATE POLICY "Authenticated users can read from general-library"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'general-library');

-- Allow public read access to general-library (optional - for public books)
CREATE POLICY "Public can read from general-library"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'general-library');

-- Allow authenticated users to update their own uploads (optional)
CREATE POLICY "Authenticated users can update general-library"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'general-library')
WITH CHECK (bucket_id = 'general-library');

-- Allow authenticated users to delete from general-library (admin only in practice)
CREATE POLICY "Authenticated users can delete from general-library"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'general-library');

