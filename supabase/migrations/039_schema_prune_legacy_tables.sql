-- Phase 2 schema pruning
-- 1) Migrate legacy highlights table data into user_books.highlights JSONB and drop legacy table.
-- 2) Consolidate analytics failure rows into analytics_events and replace analytics_event_failures table with a compatibility view.

-- -------------------------------
-- 1) Legacy highlights migration
-- -------------------------------
do $$
begin
  if to_regclass('public.highlights') is not null then
    insert into public.user_books (user_id, book_id, highlights, last_read_at, updated_at)
    select
      l.user_id,
      l.book_id,
      l.highlights_json,
      now(),
      now()
    from (
      select
        h.user_id,
        h.book_id,
        jsonb_agg(
          jsonb_build_object(
            'id', h.id::text,
            'cfi_range', h.cfi_range,
            'selected_text', h.selected_text,
            'created_at', h.created_at,
            'color', coalesce(nullif(h.color, ''), 'mint')
          )
          order by h.created_at asc
        ) as highlights_json
      from public.highlights h
      group by h.user_id, h.book_id
    ) l
    on conflict (user_id, book_id)
    do update
    set
      highlights = (
        select coalesce(jsonb_agg(elem), '[]'::jsonb)
        from (
          select distinct on (elem->>'id') elem
          from jsonb_array_elements(coalesce(user_books.highlights, '[]'::jsonb) || coalesce(excluded.highlights, '[]'::jsonb)) elem
          order by elem->>'id', elem->>'created_at' desc
        ) dedup
      ),
      updated_at = now();

    drop table if exists public.highlights;
  end if;
end $$;

-- -------------------------------------------
-- 2) Consolidate analytics failure event data
-- -------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'analytics_event_failures'
      and c.relkind = 'r'
  ) then
    insert into public.analytics_events (
      created_at,
      user_id,
      event_name,
      event_version,
      properties,
      session_id,
      device_id,
      install_id,
      app_version,
      platform,
      locale
    )
    select
      f.created_at,
      f.user_id,
      'analytics_ingest_failure',
      1,
      jsonb_build_object(
        'reason', f.reason,
        'legacy_payload', coalesce(f.payload, '{}'::jsonb)
      ),
      null,
      null,
      f.install_id,
      null,
      null,
      null
    from public.analytics_event_failures f
    where not exists (
      select 1
      from public.analytics_events e
      where e.event_name = 'analytics_ingest_failure'
        and e.created_at = f.created_at
        and coalesce(e.user_id::text, '') = coalesce(f.user_id::text, '')
        and coalesce(e.install_id, '') = coalesce(f.install_id, '')
        and coalesce(e.properties->>'reason', '') = coalesce(f.reason, '')
    );

    drop table public.analytics_event_failures;
  end if;
end $$;

create or replace view public.analytics_event_failures as
select
  e.id,
  e.created_at,
  e.user_id,
  e.install_id,
  coalesce(
    nullif(e.properties->>'reason', ''),
    nullif(e.properties->>'error', ''),
    nullif(e.properties->>'error_code', ''),
    'unknown'
  ) as reason,
  e.properties as payload
from public.analytics_events e
where e.event_name in ('analytics_flush_failed', 'analytics_ingest_failure');

revoke all on public.analytics_event_failures from public;
revoke all on public.analytics_event_failures from anon;
revoke all on public.analytics_event_failures from authenticated;

comment on view public.analytics_event_failures is
  'Compatibility view derived from analytics_events. Source table removed during schema pruning.';
