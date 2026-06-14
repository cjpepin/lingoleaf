-- Backfill RLS policies for mobile tables created in 046 on greenfield shared Supabase
-- projects (lingoleaf-web schema + 046 only). 046 enables RLS but only defined policies
-- for lingoleaf.books; other tables default-deny all writes.

-- user_settings
drop policy if exists "Users can view their own settings" on lingoleaf.user_settings;
create policy "Users can view their own settings"
  on lingoleaf.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own settings" on lingoleaf.user_settings;
create policy "Users can insert their own settings"
  on lingoleaf.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own settings" on lingoleaf.user_settings;
create policy "Users can update their own settings"
  on lingoleaf.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- study_words
drop policy if exists "Users can view their own study words" on lingoleaf.study_words;
create policy "Users can view their own study words"
  on lingoleaf.study_words for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own study words" on lingoleaf.study_words;
create policy "Users can create their own study words"
  on lingoleaf.study_words for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own study words" on lingoleaf.study_words;
create policy "Users can update their own study words"
  on lingoleaf.study_words for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own study words" on lingoleaf.study_words;
create policy "Users can delete their own study words"
  on lingoleaf.study_words for delete
  to authenticated
  using (auth.uid() = user_id);

-- user_books
drop policy if exists "Users can view their own user_books" on lingoleaf.user_books;
create policy "Users can view their own user_books"
  on lingoleaf.user_books for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own user_books" on lingoleaf.user_books;
create policy "Users can insert their own user_books"
  on lingoleaf.user_books for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own user_books" on lingoleaf.user_books;
create policy "Users can update their own user_books"
  on lingoleaf.user_books for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- vocab_lists
drop policy if exists "Users can view their own vocab lists" on lingoleaf.vocab_lists;
create policy "Users can view their own vocab lists"
  on lingoleaf.vocab_lists for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own vocab lists" on lingoleaf.vocab_lists;
create policy "Users can create their own vocab lists"
  on lingoleaf.vocab_lists for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own vocab lists" on lingoleaf.vocab_lists;
create policy "Users can update their own vocab lists"
  on lingoleaf.vocab_lists for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own vocab lists" on lingoleaf.vocab_lists;
create policy "Users can delete their own vocab lists"
  on lingoleaf.vocab_lists for delete
  to authenticated
  using (auth.uid() = user_id);

-- study_word_reviews
drop policy if exists "Users can view their own study word reviews" on lingoleaf.study_word_reviews;
create policy "Users can view their own study word reviews"
  on lingoleaf.study_word_reviews for select
  to authenticated
  using (
    exists (
      select 1 from lingoleaf.study_words sw
      where sw.id = study_word_reviews.study_word_id
        and sw.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own study word reviews" on lingoleaf.study_word_reviews;
create policy "Users can insert their own study word reviews"
  on lingoleaf.study_word_reviews for insert
  to authenticated
  with check (
    exists (
      select 1 from lingoleaf.study_words sw
      where sw.id = study_word_reviews.study_word_id
        and sw.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own study word reviews" on lingoleaf.study_word_reviews;
create policy "Users can update their own study word reviews"
  on lingoleaf.study_word_reviews for update
  to authenticated
  using (
    exists (
      select 1 from lingoleaf.study_words sw
      where sw.id = study_word_reviews.study_word_id
        and sw.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from lingoleaf.study_words sw
      where sw.id = study_word_reviews.study_word_id
        and sw.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own study word reviews" on lingoleaf.study_word_reviews;
create policy "Users can delete their own study word reviews"
  on lingoleaf.study_word_reviews for delete
  to authenticated
  using (
    exists (
      select 1 from lingoleaf.study_words sw
      where sw.id = study_word_reviews.study_word_id
        and sw.user_id = auth.uid()
    )
  );

-- user_prompt_state
drop policy if exists "Users can view their own prompt state" on lingoleaf.user_prompt_state;
create policy "Users can view their own prompt state"
  on lingoleaf.user_prompt_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert their own prompt state" on lingoleaf.user_prompt_state;
create policy "Users can upsert their own prompt state"
  on lingoleaf.user_prompt_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own prompt state" on lingoleaf.user_prompt_state;
create policy "Users can update their own prompt state"
  on lingoleaf.user_prompt_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- reading_sessions
drop policy if exists "Users can read their own reading_sessions" on lingoleaf.reading_sessions;
create policy "Users can read their own reading_sessions"
  on lingoleaf.reading_sessions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own reading_sessions" on lingoleaf.reading_sessions;
create policy "Users can insert their own reading_sessions"
  on lingoleaf.reading_sessions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own reading_sessions" on lingoleaf.reading_sessions;
create policy "Users can update their own reading_sessions"
  on lingoleaf.reading_sessions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own reading_sessions" on lingoleaf.reading_sessions;
create policy "Users can delete their own reading_sessions"
  on lingoleaf.reading_sessions for delete
  to authenticated
  using (user_id = auth.uid());

-- vocab_reviews
drop policy if exists "Users can read their own vocab_reviews" on lingoleaf.vocab_reviews;
create policy "Users can read their own vocab_reviews"
  on lingoleaf.vocab_reviews for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own vocab_reviews" on lingoleaf.vocab_reviews;
create policy "Users can insert their own vocab_reviews"
  on lingoleaf.vocab_reviews for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own vocab_reviews" on lingoleaf.vocab_reviews;
create policy "Users can update their own vocab_reviews"
  on lingoleaf.vocab_reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own vocab_reviews" on lingoleaf.vocab_reviews;
create policy "Users can delete their own vocab_reviews"
  on lingoleaf.vocab_reviews for delete
  to authenticated
  using (user_id = auth.uid());

-- user_garden_state
drop policy if exists "Users can read their own user_garden_state" on lingoleaf.user_garden_state;
create policy "Users can read their own user_garden_state"
  on lingoleaf.user_garden_state for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own user_garden_state" on lingoleaf.user_garden_state;
create policy "Users can insert their own user_garden_state"
  on lingoleaf.user_garden_state for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own user_garden_state" on lingoleaf.user_garden_state;
create policy "Users can update their own user_garden_state"
  on lingoleaf.user_garden_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own user_garden_state" on lingoleaf.user_garden_state;
create policy "Users can delete their own user_garden_state"
  on lingoleaf.user_garden_state for delete
  to authenticated
  using (user_id = auth.uid());

-- user_garden_daily_progress
drop policy if exists "Users can read their own user_garden_daily_progress" on lingoleaf.user_garden_daily_progress;
create policy "Users can read their own user_garden_daily_progress"
  on lingoleaf.user_garden_daily_progress for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own user_garden_daily_progress" on lingoleaf.user_garden_daily_progress;
create policy "Users can insert their own user_garden_daily_progress"
  on lingoleaf.user_garden_daily_progress for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own user_garden_daily_progress" on lingoleaf.user_garden_daily_progress;
create policy "Users can update their own user_garden_daily_progress"
  on lingoleaf.user_garden_daily_progress for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own user_garden_daily_progress" on lingoleaf.user_garden_daily_progress;
create policy "Users can delete their own user_garden_daily_progress"
  on lingoleaf.user_garden_daily_progress for delete
  to authenticated
  using (user_id = auth.uid());
