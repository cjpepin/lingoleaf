-- [2026-03-03] [DB] Add calm garden progression state for daily habit loop

create table if not exists public.user_garden_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_gp integer not null default 0 check (total_gp >= 0),
  stage text not null default 'seed' check (stage in ('seed', 'sprout', 'sapling', 'young_tree', 'mature_tree')),
  freshness text not null default 'fresh' check (freshness in ('fresh', 'resting', 'dormant')),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_goal_completed_on date,
  last_activity_on date,
  unlocks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_garden_daily_progress (
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

create index if not exists idx_user_garden_daily_progress_user_day
  on public.user_garden_daily_progress(user_id, day desc);

alter table public.user_garden_state enable row level security;
alter table public.user_garden_daily_progress enable row level security;

drop policy if exists "Users can read their own user_garden_state" on public.user_garden_state;
create policy "Users can read their own user_garden_state"
  on public.user_garden_state for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own user_garden_state" on public.user_garden_state;
create policy "Users can insert their own user_garden_state"
  on public.user_garden_state for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own user_garden_state" on public.user_garden_state;
create policy "Users can update their own user_garden_state"
  on public.user_garden_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own user_garden_state" on public.user_garden_state;
create policy "Users can delete their own user_garden_state"
  on public.user_garden_state for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can read their own user_garden_daily_progress" on public.user_garden_daily_progress;
create policy "Users can read their own user_garden_daily_progress"
  on public.user_garden_daily_progress for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own user_garden_daily_progress" on public.user_garden_daily_progress;
create policy "Users can insert their own user_garden_daily_progress"
  on public.user_garden_daily_progress for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own user_garden_daily_progress" on public.user_garden_daily_progress;
create policy "Users can update their own user_garden_daily_progress"
  on public.user_garden_daily_progress for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own user_garden_daily_progress" on public.user_garden_daily_progress;
create policy "Users can delete their own user_garden_daily_progress"
  on public.user_garden_daily_progress for delete
  to authenticated
  using (user_id = auth.uid());

comment on table public.user_garden_state is 'Persistent calm gamification state for each user.';
comment on table public.user_garden_daily_progress is 'Daily counters used to apply GP caps and one-time daily bonuses.';
