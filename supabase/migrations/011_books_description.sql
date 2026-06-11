-- Add optional book description for details screen + future catalog improvements

ALTER TABLE lingoleaf.books
  ADD COLUMN IF NOT EXISTS description TEXT;


