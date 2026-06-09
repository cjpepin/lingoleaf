-- [2026-01-03] [DB] Add popularity_score for Gutenberg ranking (supabase/migrations/014_books_popularity_score.sql)

alter table public.books
  add column if not exists popularity_score integer;

create index if not exists books_popularity_score_idx
  on public.books (popularity_score desc nulls last);


