-- Subject filter: when a language is selected, only return subjects that have books in that language
CREATE OR REPLACE FUNCTION get_distinct_book_subjects(p_lang text DEFAULT NULL)
RETURNS TABLE(subject text) AS $$
  SELECT DISTINCT TRIM(unnest(subjects))::text
  FROM books
  WHERE subjects IS NOT NULL
    AND array_length(subjects, 1) > 0
    AND (p_lang IS NULL OR trim(p_lang) = '' OR source_lang = trim(p_lang))
  ORDER BY 1;
$$ LANGUAGE sql STABLE;
