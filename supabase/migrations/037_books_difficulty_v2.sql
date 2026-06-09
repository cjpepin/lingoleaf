alter table public.books
  add column if not exists sentence_len_p90 double precision,
  add column if not exists comma_per_1k_chars double precision,
  add column if not exists avg_word_len double precision,
  add column if not exists dialogue_ratio double precision,
  add column if not exists oov_5k double precision,
  add column if not exists oov_20k double precision,
  add column if not exists hapax_rate double precision,
  add column if not exists lex_subscore double precision,
  add column if not exists syn_subscore double precision,
  add column if not exists difficulty_score double precision,
  add column if not exists difficulty_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'books_difficulty_label_check'
  ) then
    alter table public.books
      add constraint books_difficulty_label_check
      check (difficulty_label is null or difficulty_label in ('easy', 'medium', 'hard'));
  end if;
end $$;

create index if not exists books_difficulty_score_idx on public.books(difficulty_score);
create index if not exists books_difficulty_label_idx on public.books(difficulty_label);
create index if not exists books_oov_20k_idx on public.books(oov_20k);
