-- Function to get distinct subject values for library filter dropdown
CREATE OR REPLACE FUNCTION lingoleaf.get_distinct_book_subjects()
RETURNS TABLE(subject text) AS $$
  SELECT DISTINCT TRIM(unnest(subjects))::text
  FROM lingoleaf.books
  WHERE subjects IS NOT NULL
    AND array_length(subjects, 1) > 0
  ORDER BY 1;
$$ LANGUAGE sql STABLE;
