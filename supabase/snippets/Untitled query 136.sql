-- Run in Supabase SQL Editor if update_app_user_admin is missing or schema cache is stale.
-- Then run: NOTIFY pgrst, 'reload schema';

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

grant execute on function public.update_app_user_admin(text, text, text, text, text, text) to anon;

-- Reload PostgREST schema cache so the function is visible to the API
notify pgrst, 'reload schema';
