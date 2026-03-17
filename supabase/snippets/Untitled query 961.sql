-- Full app_users setup (run once)
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  name text not null default '',
  position text not null default 'Clerk',
  email text not null default '',
  must_change_password boolean default true,
  created_at timestamptz default now()
);

alter table public.app_users enable row level security;

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

create or replace function public.create_app_user(
  p_admin_username text, p_admin_password text,
  p_new_username text, p_new_password text, p_new_name text, p_new_position text, p_new_email text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_admin_id uuid; v_new_id uuid;
begin
  select u.id into v_admin_id from public.app_users u
  where u.username = p_admin_username and u.password_hash = crypt(p_admin_password, u.password_hash) and u.position = 'Superuser';
  if v_admin_id is null then raise exception 'Invalid admin credentials or not a superuser'; end if;
  insert into public.app_users (username, password_hash, name, position, email, must_change_password)
  values (p_new_username, crypt(p_new_password, gen_salt('bf')), p_new_name, p_new_position, p_new_email, true)
  returning app_users.id into v_new_id;
  return v_new_id;
end;
$$;

grant execute on function public.login(text, text) to anon;
grant execute on function public.create_app_user(text, text, text, text, text, text, text) to anon;

insert into public.app_users (username, password_hash, name, position, email, must_change_password)
values ('kevjacob', crypt('Brother87@', gen_salt('bf')), 'Kelvin Sim', 'Superuser', 'kelvin@taisay.my', false)
on conflict (username) do nothing;