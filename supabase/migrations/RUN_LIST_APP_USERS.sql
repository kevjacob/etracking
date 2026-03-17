-- Run in Supabase SQL Editor to create list_app_users and other account-management RPCs.
-- Then run: NOTIFY pgrst, 'reload schema';

-- Parameter p_username. Returns JSONB (avoids RETURNS TABLE schema-cache issues).
create or replace function public.list_app_users(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.app_users u
    where u.username = p_username and u.position = 'Superuser'
  ) then
    raise exception 'Only a superuser can list accounts';
  end if;
  select coalesce(
    (select jsonb_agg(row_to_json(t)::jsonb)
     from (
       select u.id, u.username, u.name, u.position, u.email, coalesce(u.mobile, '') as mobile
       from public.app_users u
       order by u.username
     ) t),
    '[]'::jsonb
  ) into result;
  return result;
end;
$$;

create or replace function public.update_app_user_admin(
  p_admin_username text,
  p_email text,
  p_mobile text,
  p_name text,
  p_position text,
  p_target_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users u
    where u.username = p_admin_username and u.position = 'Superuser'
  ) then
    raise exception 'Only a superuser can update accounts';
  end if;
  update public.app_users u
  set name = coalesce(nullif(trim(p_name), ''), u.name),
      "position" = coalesce(nullif(trim(p_position), ''), u.position),
      email = coalesce(nullif(trim(p_email), ''), u.email),
      mobile = coalesce(nullif(trim(p_mobile), ''), '')
  where u.username = p_target_username;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

create or replace function public.set_user_password_admin(
  p_admin_username text,
  p_new_password text,
  p_target_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users u
    where u.username = p_admin_username and u.position = 'Superuser'
  ) then
    raise exception 'Only a superuser can set user password';
  end if;
  update public.app_users u
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      must_change_password = true
  where u.username = p_target_username;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

create or replace function public.delete_app_user(
  p_admin_username text,
  p_target_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users u
    where u.username = p_admin_username and u.position = 'Superuser'
  ) then
    raise exception 'Only a superuser can delete accounts';
  end if;
  if p_admin_username = p_target_username then
    raise exception 'You cannot delete your own account';
  end if;
  delete from public.app_users u where u.username = p_target_username;
end;
$$;

grant execute on function public.list_app_users(text) to anon;
grant execute on function public.update_app_user_admin(text, text, text, text, text, text) to anon;
grant execute on function public.set_user_password_admin(text, text, text) to anon;
grant execute on function public.delete_app_user(text, text) to anon;

-- Reload PostgREST schema cache so the new functions are visible
notify pgrst, 'reload schema';
