-- Materialize LingoLeaf mobile tables when schema_migrations history exists but DDL
-- was never applied (common on shared Supabase projects that started with lingoleaf-web).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core catalog
-- ---------------------------------------------------------------------------

create table if not exists lingoleaf.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  storage_path text,
  cover_path text,
  source_lang text,
  created_at timestamptz default now(),
  source text not null default 'admin',
  source_id text,
  epub_url text,
  cover_url text,
  languages text[],
  subjects text[],
  bookshelves text[],
  subjects_text text,
  description text,
  is_general boolean default false,
  popularity_score integer,
  word_count integer,
  unique_word_count integer,
  avg_sentence_len real,
  lexical_score real,
  estimated_cefr text,
  lookup_rate_est text,
  difficulty text,
  tags text[],
  processed_at timestamptz,
  metadata_version integer not null default 1,
  sample_text text,
  language text,
  sentence_len_p90 double precision,
  comma_per_1k_chars double precision,
  avg_word_len double precision,
  dialogue_ratio double precision,
  oov_5k double precision,
  oov_20k double precision,
  hapax_rate double precision,
  lex_subscore double precision,
  syn_subscore double precision,
  difficulty_score double precision,
  difficulty_label text
);

create unique index if not exists idx_books_source_source_id_unique
  on lingoleaf.books (source, source_id);

create table if not exists lingoleaf.translation_cache (
  source_lang text not null,
  target_lang text not null,
  term_normalized text not null,
  translation text not null,
  created_at timestamptz default now(),
  primary key (source_lang, target_lang, term_normalized)
);

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------

create table if not exists lingoleaf.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_lang text not null default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  source_lang text,
  admin boolean default false,
  deleted_at timestamptz,
  reader_highlight_on_translate boolean default true,
  reader_font_size varchar(20) default '100%',
  reader_font_family varchar(100) default 'inherit',
  reader_highlight_color varchar(20) default 'mint',
  flashcard_again_cards integer default 2,
  flashcard_interval_hard_min integer default 10,
  flashcard_interval_good_min integer default 1440,
  flashcard_interval_easy_min integer default 4320,
  flashcard_interval_multiplier real default 2,
  app_lang text default 'en',
  native_lang varchar(10) default 'en',
  known_langs text[] default array['en'],
  goal_langs text[] default array[]::text[],
  known_lang_levels jsonb default '{}'::jsonb,
  goal_lang_levels jsonb default '{}'::jsonb,
  auto_remove_downloads_after_days integer default 14,
  translate_count integer default 0,
  translate_window_start timestamptz,
  is_premium boolean default false,
  premium_plan text,
  premium_updated_at timestamptz,
  daily_reading_goal_minutes integer not null default 10,
  daily_words_saved_goal integer,
  daily_words_learned_goal integer,
  primary_goal text,
  goal_priority text[],
  daily_goal_reminder_enabled boolean default false,
  daily_goal_reminder_hour integer,
  daily_goal_reminder_minute integer
);

create table if not exists lingoleaf.study_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references lingoleaf.books(id) on delete cascade,
  source_lang text not null,
  target_lang text not null,
  term text not null,
  term_normalized text not null,
  translation text not null,
  context_snippet text,
  created_at timestamptz default now(),
  list_id uuid,
  starred boolean default false
);

create table if not exists lingoleaf.user_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references lingoleaf.books(id) on delete cascade,
  last_cfi text,
  last_read_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  highlights jsonb not null default '[]'::jsonb,
  status text,
  primary key (user_id, book_id)
);

create table if not exists lingoleaf.vocab_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_used_at timestamptz
);

create table if not exists lingoleaf.study_word_reviews (
  study_word_id uuid primary key references lingoleaf.study_words(id) on delete cascade,
  next_review_at timestamptz not null default now(),
  interval_minutes integer not null default 15,
  last_rating text,
  review_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists lingoleaf.user_prompt_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_key text not null,
  last_shown_at timestamptz,
  primary key (user_id, prompt_key)
);

create table if not exists lingoleaf.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null,
  book_id uuid references lingoleaf.books(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists lingoleaf.vocab_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  study_word_id uuid references lingoleaf.study_words(id) on delete set null
);

create table if not exists lingoleaf.user_garden_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_gp integer not null default 0 check (total_gp >= 0),
  stage text not null default 'seed',
  freshness text not null default 'fresh',
  streak_days integer not null default 0 check (streak_days >= 0),
  last_goal_completed_on date,
  last_activity_on date,
  unlocks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lingoleaf.user_garden_daily_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  reading_minutes integer not null default 0 check (reading_minutes >= 0),
  saved_count integer not null default 0 check (saved_count >= 0),
  learned_count integer not null default 0 check (learned_count >= 0),
  gp_awarded integer not null default 0 check (gp_awarded >= 0),
  goal_completed boolean not null default false,
  streak_bonus_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Align mobile analytics columns when lingoleaf-web created analytics_events first.
alter table lingoleaf.analytics_events
  add column if not exists properties jsonb,
  add column if not exists session_id text,
  add column if not exists device_id text;

update lingoleaf.analytics_events
set properties = coalesce(properties, metadata, '{}'::jsonb)
where properties is null;

-- ---------------------------------------------------------------------------
-- RLS (idempotent)
-- ---------------------------------------------------------------------------

alter table lingoleaf.books enable row level security;
alter table lingoleaf.translation_cache enable row level security;
alter table lingoleaf.user_settings enable row level security;
alter table lingoleaf.study_words enable row level security;
alter table lingoleaf.user_books enable row level security;
alter table lingoleaf.vocab_lists enable row level security;
alter table lingoleaf.study_word_reviews enable row level security;
alter table lingoleaf.user_prompt_state enable row level security;
alter table lingoleaf.reading_sessions enable row level security;
alter table lingoleaf.vocab_reviews enable row level security;
alter table lingoleaf.user_garden_state enable row level security;
alter table lingoleaf.user_garden_daily_progress enable row level security;

drop policy if exists "Books are viewable by authenticated users" on lingoleaf.books;
create policy "Books are viewable by authenticated users"
  on lingoleaf.books for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert books" on lingoleaf.books;
create policy "Authenticated users can insert books"
  on lingoleaf.books for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update books" on lingoleaf.books;
create policy "Authenticated users can update books"
  on lingoleaf.books for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete books" on lingoleaf.books;
create policy "Authenticated users can delete books"
  on lingoleaf.books for delete
  to authenticated
  using (true);
