-- Add optional book description for details screen + future catalog improvements

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS description TEXT;


