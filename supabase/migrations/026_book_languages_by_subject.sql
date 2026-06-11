-- Language filter: when subject(s) are selected, only return languages that have lingoleaf.books in those subjects
CREATE OR REPLACE FUNCTION lingoleaf.get_distinct_book_languages(p_subjects text[] DEFAULT NULL)
RETURNS TABLE(lang_code text) AS $$
  SELECT DISTINCT source_lang
  FROM lingoleaf.books
  WHERE source_lang IS NOT NULL
    AND trim(source_lang) <> ''
    AND (p_subjects IS NULL OR array_length(p_subjects, 1) IS NULL OR subjects && p_subjects)
  ORDER BY 1;
$$ LANGUAGE sql STABLE;
