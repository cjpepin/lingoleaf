-- [2026-03-04] [DB] Expand garden stage progression with higher-tier states.

alter table public.user_garden_state
  drop constraint if exists user_garden_state_stage_check;

alter table public.user_garden_state
  add constraint user_garden_state_stage_check
  check (
    stage in (
      'seed',
      'sprout',
      'sapling',
      'young_tree',
      'mature_tree',
      'blooming_tree',
      'ancient_tree'
    )
  );
