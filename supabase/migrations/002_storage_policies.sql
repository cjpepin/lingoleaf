-- Storage policies for lingoleaf.books bucket
-- Allow authenticated users to read EPUB files

-- Create policy to allow authenticated users to read from lingoleaf.books bucket
CREATE POLICY "Authenticated users can read books"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'general-library');

-- Create policy to allow service role to manage lingoleaf.books (for admin uploads)
CREATE POLICY "Service role can manage books"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'general-library');

