-- Analytics event sink + ingest helpers

create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  event_name text not null,
  event_version int not null default 1,
  properties jsonb not null,
  session_id text,
  device_id text,
  install_id text,
  app_version text,
  platform text,
  locale text
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_user_id_idx on public.analytics_events (user_id);
create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name);
create index if not exists analytics_events_install_id_idx on public.analytics_events (install_id);

create table if not exists public.analytics_event_failures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  install_id text,
  reason text not null,
  payload jsonb
);

alter table public.analytics_events enable row level security;
alter table public.analytics_event_failures enable row level security;

grant insert, select on public.analytics_events to anon, authenticated;
grant insert, select on public.analytics_event_failures to anon, authenticated;

-- Insert allowed for authenticated users (own user id or anonymous user_id null) and anon (user_id null only).
drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (
    (auth.role() = 'anon' and user_id is null)
    or (auth.role() = 'authenticated' and (user_id is null or user_id = auth.uid()))
  );

-- Select only own rows (for debug/dev tooling).
drop policy if exists analytics_events_select_own on public.analytics_events;
create policy analytics_events_select_own
  on public.analytics_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists analytics_failures_insert on public.analytics_event_failures;
create policy analytics_failures_insert
  on public.analytics_event_failures
  for insert
  to anon, authenticated
  with check (
    (auth.role() = 'anon' and user_id is null)
    or (auth.role() = 'authenticated' and (user_id is null or user_id = auth.uid()))
  );

drop policy if exists analytics_failures_select_own on public.analytics_event_failures;
create policy analytics_failures_select_own
  on public.analytics_event_failures
  for select
  to authenticated
  using (user_id = auth.uid());

-- Optional RPC fallback if you prefer DB RPC over Edge Function.
create or replace function public.analytics_ingest_batch(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;

  insert into public.analytics_events (
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
    nullif(evt->>'user_id', '')::uuid,
    coalesce(evt->>'event_name', 'unknown_event'),
    coalesce((evt->>'event_version')::int, 1),
    coalesce(evt->'properties', '{}'::jsonb),
    evt->>'session_id',
    evt->>'device_id',
    evt->>'install_id',
    evt->>'app_version',
    evt->>'platform',
    evt->>'locale'
  from jsonb_array_elements(p_events) as evt;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.analytics_ingest_batch(jsonb) to anon, authenticated;
