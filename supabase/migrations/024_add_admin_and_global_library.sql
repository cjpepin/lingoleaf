-- Add admin column to lingoleaf.user_settings
-- Run this in Supabase SQL Editor

-- Add admin column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'lingoleaf' AND table_name = 'user_settings' AND column_name='admin') THEN
    ALTER TABLE lingoleaf.user_settings ADD COLUMN admin BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update existing rows to have default value
UPDATE lingoleaf.user_settings
SET admin = COALESCE(admin, false)
WHERE admin IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.admin IS 'Whether the user has admin privileges';

-- Create general-library storage bucket (if not exists)
-- Note: This needs to be run in the Supabase dashboard Storage section
-- or via the Supabase CLI/API, as SQL doesn't directly create storage buckets.
-- 
-- To create the bucket manually:
-- 1. Go to Storage in Supabase dashboard
-- 2. Create new bucket named "general-library"
-- 3. Set it to public (or configure RLS as needed)
-- 4. Allow file uploads for authenticated users

-- Create general-library table is_general column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'lingoleaf' AND table_name = 'books' AND column_name='is_general') THEN
    ALTER TABLE lingoleaf.books ADD COLUMN is_general BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN books.is_general IS 'Whether the book is available to all users in the general library';

-- Create index for faster general book queries
CREATE INDEX IF NOT EXISTS idx_books_is_general ON lingoleaf.books(is_general) WHERE is_general = true;

