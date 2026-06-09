-- Add INSERT policy for books table
-- Allows authenticated users to insert books (admin uploads)
-- Run this in Supabase SQL Editor

-- Allow authenticated users to insert books
CREATE POLICY "Authenticated users can insert books"
ON books
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Optional: If you want to restrict to admins only, use this instead:
-- CREATE POLICY "Admins can insert books"
-- ON books
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM user_settings
--     WHERE user_id = auth.uid()
--     AND admin = true
--   )
-- );

-- Allow authenticated users to update books (for metadata edits)
CREATE POLICY "Authenticated users can update books"
ON books
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete books (admin functionality)
CREATE POLICY "Authenticated users can delete books"
ON books
FOR DELETE
TO authenticated
USING (true);

