create or replace function public.create_app_user(
  p_admin_username text,
  p_new_email text,
  p_new_name text,
  p_new_password text,
  p_new_position text,
  p_new_username text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_new_id uuid;
begin
  select u.id into v_admin_id
  from public.app_users u
  where u.username = p_admin_username and u.position = 'Superuser';
  if v_admin_id is null then
    raise exception 'Only a superuser can create accounts';
  end if;
  insert into public.app_users (username, password_hash, name, position, email, must_change_password)
  values (p_new_username, extensions.crypt(p_new_password, extensions.gen_salt('bf')), p_new_name, p_new_position, p_new_email, true)
  returning app_users.id into v_new_id;
  return v_new_id;
end;
$$;

notify pgrst, 'reload schema';