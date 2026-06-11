-- Move legacy LingoLeaf objects from public into the lingoleaf schema.
-- Needed for databases that applied migrations 001-044 before the dedicated-schema cutover.
-- No-op on fresh installs where tables were created directly under lingoleaf.

create schema if not exists lingoleaf;

grant usage on schema lingoleaf to postgres, anon, authenticated, service_role;

alter default privileges in schema lingoleaf
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema lingoleaf
  grant all on sequences to anon, authenticated, service_role;

alter default privileges in schema lingoleaf
  grant all on functions to anon, authenticated, service_role;

do $$
declare
  obj record;
  lingoleaf_relations text[] := array[
    'books',
    'highlights',
    'study_words',
    'translation_cache',
    'user_settings',
    'vocab_lists',
    'user_books',
    'reading_sessions',
    'vocab_reviews',
    'study_word_reviews',
    'user_prompt_state',
    'analytics_events',
    'analytics_event_failures',
    'user_garden_state',
    'user_garden_daily_progress'
  ];
begin
  for obj in
    select c.relname as object_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'v', 'm')
      and c.relname = any(lingoleaf_relations)
      and not exists (
        select 1
        from pg_class c2
        join pg_namespace n2 on n2.oid = c2.relnamespace
        where n2.nspname = 'lingoleaf'
          and c2.relname = c.relname
      )
  loop
    execute format('alter table public.%I set schema lingoleaf', obj.object_name);
  end loop;
end $$;

do $$
declare
  fn record;
  lingoleaf_functions text[] := array[
    'guard_user_settings_privileged_columns',
    'get_distinct_book_tags',
    'reactivate_user_account',
    'is_app_admin',
    'analytics_ingest_batch',
    'analytics_admin_dashboard',
    'analytics_admin_recent_events',
    'get_distinct_book_languages',
    'get_distinct_book_subjects',
    'soft_delete_user_account'
  ];
begin
  for fn in
    select
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(lingoleaf_functions)
      and not exists (
        select 1
        from pg_proc p2
        join pg_namespace n2 on n2.oid = p2.pronamespace
        where n2.nspname = 'lingoleaf'
          and p2.proname = p.proname
          and pg_get_function_identity_arguments(p2.oid) = pg_get_function_identity_arguments(p.oid)
      )
  loop
    if fn.args = '' then
      execute format('alter function public.%I() set schema lingoleaf', fn.function_name);
    else
      execute format(
        'alter function public.%I(%s) set schema lingoleaf',
        fn.function_name,
        fn.args
      );
    end if;
  end loop;
end $$;
