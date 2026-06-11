-- [2026-03-01] [DB] Add computed metadata columns for book picking UX and filtering

alter table lingoleaf.books
  add column if not exists word_count integer,
  add column if not exists unique_word_count integer,
  add column if not exists avg_sentence_len real,
  add column if not exists lexical_score real,
  add column if not exists estimated_cefr text,
  add column if not exists lookup_rate_est text,
  add column if not exists difficulty text,
  add column if not exists tags text[],
  add column if not exists processed_at timestamptz,
  add column if not exists metadata_version integer not null default 1,
  add column if not exists sample_text text,
  add column if not exists language text;

update lingoleaf.books
set language = coalesce(language, source_lang)
where language is null and source_lang is not null;

create index if not exists idx_books_language_difficulty
  on lingoleaf.books(language, difficulty);

create index if not exists idx_books_language_cefr
  on lingoleaf.books(language, estimated_cefr);

create index if not exists idx_books_word_count
  on lingoleaf.books(word_count);

create index if not exists idx_books_tags_gin
  on lingoleaf.books using gin(tags);

-- Distinct tags helper for UI filters
create or replace function lingoleaf.get_distinct_book_tags(p_lang text default null)
returns table(tag text)
language sql
stable
as $$
  select distinct unnest(b.tags) as tag
  from lingoleaf.books b
  where b.tags is not null
    and (
      p_lang is null
      or coalesce(b.language, b.source_lang) = p_lang
    )
  order by tag;
$$;

grant execute on function lingoleaf.get_distinct_book_tags(text) to anon, authenticated;
