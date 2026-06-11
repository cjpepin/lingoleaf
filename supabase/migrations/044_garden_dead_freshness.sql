-- [2026-03-19] [DB] Rename dormant freshness to dead and add stage regression penalty.

-- Migrate existing rows first (while old constraint still allows 'dormant').
update lingoleaf.user_garden_state
  set freshness = 'dead'
  where freshness = 'dormant';

-- Replace the freshness check constraint.
alter table lingoleaf.user_garden_state
  drop constraint if exists user_garden_state_freshness_check;

alter table lingoleaf.user_garden_state
  add constraint user_garden_state_freshness_check
  check (freshness in ('fresh', 'resting', 'dead'));
