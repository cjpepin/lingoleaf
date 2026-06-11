-- Guard privileged/server-managed lingoleaf.user_settings columns from direct client writes.

create or replace function lingoleaf.guard_user_settings_privileged_columns()
returns trigger
language plpgsql
set search_path = lingoleaf, pg_temp
as $$
begin
  -- Allow service-role calls, migrations, and security-definer helpers to manage these fields.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.admin, false) <> false then
      raise exception 'user_settings.admin is server-managed';
    end if;

    if coalesce(new.is_premium, false) <> false
      or new.premium_plan is not null
      or new.premium_updated_at is not null then
      raise exception 'premium entitlement fields are server-managed';
    end if;

    if new.deleted_at is not null then
      raise exception 'user_settings.deleted_at is server-managed';
    end if;

    if coalesce(new.translate_count, 0) <> 0
      or new.translate_window_start is not null then
      raise exception 'translation rate-limit fields are server-managed';
    end if;

    return new;
  end if;

  if coalesce(new.admin, false) is distinct from coalesce(old.admin, false) then
    raise exception 'user_settings.admin is server-managed';
  end if;

  if coalesce(new.is_premium, false) is distinct from coalesce(old.is_premium, false)
    or new.premium_plan is distinct from old.premium_plan
    or new.premium_updated_at is distinct from old.premium_updated_at then
    raise exception 'premium entitlement fields are server-managed';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'user_settings.deleted_at is server-managed';
  end if;

  if coalesce(new.translate_count, 0) is distinct from coalesce(old.translate_count, 0)
    or new.translate_window_start is distinct from old.translate_window_start then
    raise exception 'translation rate-limit fields are server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_user_settings_privileged_columns on lingoleaf.user_settings;

create trigger guard_user_settings_privileged_columns
before insert or update on lingoleaf.user_settings
for each row
execute function lingoleaf.guard_user_settings_privileged_columns();
