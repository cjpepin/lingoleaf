-- Indexes and constraints missing from 046 greenfield mobile DDL.
-- createStudyWord upserts on (user_id, book_id, source_lang, target_lang, term_normalized, list_id).

create unique index if not exists idx_study_words_unique
  on lingoleaf.study_words (user_id, book_id, source_lang, target_lang, term_normalized, list_id);

create index if not exists idx_study_words_user
  on lingoleaf.study_words (user_id, created_at desc);

create index if not exists idx_study_words_user_book
  on lingoleaf.study_words (user_id, book_id);

create index if not exists idx_study_words_list
  on lingoleaf.study_words (user_id, list_id, created_at desc);

create index if not exists idx_study_words_starred
  on lingoleaf.study_words (user_id, list_id, starred)
  where starred = true;

create unique index if not exists idx_vocab_lists_user_name_unique
  on lingoleaf.vocab_lists (user_id, lower(name));

create index if not exists idx_vocab_lists_user_last_used
  on lingoleaf.vocab_lists (user_id, last_used_at desc nulls last);

create index if not exists idx_vocab_lists_user_created
  on lingoleaf.vocab_lists (user_id, created_at asc);

create index if not exists idx_user_books_user_updated
  on lingoleaf.user_books (user_id, updated_at desc);

create index if not exists idx_user_books_user_last_read
  on lingoleaf.user_books (user_id, last_read_at desc);

create index if not exists idx_study_word_reviews_next
  on lingoleaf.study_word_reviews (next_review_at);

-- 046 defines list_id without FK; align with 007 when vocab_lists exists.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'study_words_list_id_fkey'
      and connamespace = 'lingoleaf'::regnamespace
  ) then
    alter table lingoleaf.study_words
      add constraint study_words_list_id_fkey
      foreign key (list_id) references lingoleaf.vocab_lists (id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;
