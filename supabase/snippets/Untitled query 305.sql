create or replace function public.login(p_password text, p_username text)
returns table (id uuid, name text, "position" text, email text)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  select u.id, u.name, u.position, u.email
  from public.app_users u
  where u.username = p_username and u.password_hash = crypt(p_password, u.password_hash);
end;
$$;