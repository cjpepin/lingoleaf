-- Harden analytics security and expose admin-only analytics RPCs.

create extension if not exists pgcrypto;

-- Remove direct analytics reads from client roles; keep inserts for ingestion.
revoke select on table public.analytics_events from anon, authenticated;
revoke select on table public.analytics_event_failures from anon, authenticated;
grant insert on table public.analytics_events to anon, authenticated;
grant insert on table public.analytics_event_failures to anon, authenticated;

-- Remove legacy per-user read policies; reads should only go through admin RPCs.
drop policy if exists analytics_events_select_own on public.analytics_events;
drop policy if exists analytics_failures_select_own on public.analytics_event_failures;

-- Harden batch ingest: never trust caller user_id.
create or replace function public.analytics_ingest_batch(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer := 0;
  effective_user_id uuid := auth.uid();
begin
  if auth.role() not in ('anon', 'authenticated') then
    raise exception 'Unauthorized analytics ingest caller.';
  end if;

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
    effective_user_id,
    nullif(trim(evt->>'event_name'), ''),
    case
      when coalesce(evt->>'event_version', '') ~ '^[0-9]+$' then greatest((evt->>'event_version')::int, 1)
      else 1
    end,
    case
      when jsonb_typeof(evt->'properties') = 'object' then evt->'properties'
      else '{}'::jsonb
    end,
    nullif(trim(evt->>'session_id'), ''),
    nullif(trim(evt->>'device_id'), ''),
    nullif(trim(evt->>'install_id'), ''),
    nullif(trim(evt->>'app_version'), ''),
    nullif(trim(evt->>'platform'), ''),
    nullif(trim(evt->>'locale'), '')
  from jsonb_array_elements(p_events) as evt
  where jsonb_typeof(evt) = 'object'
    and nullif(trim(evt->>'event_name'), '') is not null;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.analytics_ingest_batch(jsonb) from public;
revoke all on function public.analytics_ingest_batch(jsonb) from anon, authenticated;
grant execute on function public.analytics_ingest_batch(jsonb) to anon, authenticated;

-- Admin-only aggregate dashboard payload.
create or replace function public.analytics_admin_dashboard(
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  from_ts timestamptz := coalesce(p_from, now() - interval '30 days');
  to_ts timestamptz := coalesce(p_to, now());
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Only authenticated users can access analytics dashboard data.';
  end if;

  if not public.is_forum_admin() then
    raise exception 'Only forum admins can access analytics dashboard data.';
  end if;

  if from_ts >= to_ts then
    raise exception 'Invalid analytics range.';
  end if;

  return jsonb_build_object(
    'from', from_ts,
    'to', to_ts,
    'totals', jsonb_build_object(
      'events', (
        select count(*)::bigint
        from public.analytics_events e
        where e.created_at >= from_ts and e.created_at <= to_ts
      ),
      'failures', (
        select count(*)::bigint
        from public.analytics_event_failures f
        where f.created_at >= from_ts and f.created_at <= to_ts
      ),
      'users', (
        select count(distinct e.user_id)::bigint
        from public.analytics_events e
        where e.created_at >= from_ts and e.created_at <= to_ts and e.user_id is not null
      ),
      'installs', (
        select count(distinct e.install_id)::bigint
        from public.analytics_events e
        where e.created_at >= from_ts and e.created_at <= to_ts and coalesce(e.install_id, '') <> ''
      )
    ),
    'top_events', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select e.event_name, count(*)::bigint as count
        from public.analytics_events e
        where e.created_at >= from_ts and e.created_at <= to_ts
        group by e.event_name
        order by count(*) desc, e.event_name asc
        limit 12
      ) as t
    ), '[]'::jsonb),
    'daily_series', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select
          date_trunc('day', d.day) as day,
          coalesce(ev.events, 0)::bigint as events,
          coalesce(fl.failures, 0)::bigint as failures
        from generate_series(date_trunc('day', from_ts), date_trunc('day', to_ts), interval '1 day') as d(day)
        left join (
          select date_trunc('day', e.created_at) as day, count(*) as events
          from public.analytics_events e
          where e.created_at >= from_ts and e.created_at <= to_ts
          group by 1
        ) ev on ev.day = d.day
        left join (
          select date_trunc('day', f.created_at) as day, count(*) as failures
          from public.analytics_event_failures f
          where f.created_at >= from_ts and f.created_at <= to_ts
          group by 1
        ) fl on fl.day = d.day
        order by d.day asc
      ) as t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.analytics_admin_dashboard(timestamptz, timestamptz) from public;
revoke all on function public.analytics_admin_dashboard(timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.analytics_admin_dashboard(timestamptz, timestamptz) to authenticated;

-- Admin-only recent events without properties payload.
create or replace function public.analytics_admin_recent_events(
  p_limit integer default 50,
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now()
)
returns table (
  id uuid,
  created_at timestamptz,
  user_id uuid,
  event_name text,
  event_version integer,
  install_id text,
  app_version text,
  platform text,
  locale text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  bounded_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  from_ts timestamptz := coalesce(p_from, now() - interval '30 days');
  to_ts timestamptz := coalesce(p_to, now());
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Only authenticated users can access analytics dashboard data.';
  end if;

  if not public.is_forum_admin() then
    raise exception 'Only forum admins can access analytics dashboard data.';
  end if;

  if from_ts >= to_ts then
    raise exception 'Invalid analytics range.';
  end if;

  return query
  select
    e.id,
    e.created_at,
    e.user_id,
    e.event_name,
    e.event_version,
    e.install_id,
    e.app_version,
    e.platform,
    e.locale
  from public.analytics_events e
  where e.created_at >= from_ts and e.created_at <= to_ts
  order by e.created_at desc
  limit bounded_limit;
end;
$$;

revoke all on function public.analytics_admin_recent_events(integer, timestamptz, timestamptz) from public;
revoke all on function public.analytics_admin_recent_events(integer, timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.analytics_admin_recent_events(integer, timestamptz, timestamptz) to authenticated;
