-- Run this once in Supabase SQL Editor if app_users doesn't exist yet.
-- Creates table, RLS, login + create_app_user, grants, and seed superuser.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  name text not null default '',
  position text not null default 'Clerk',
  email text not null default '',
  mobile text default '',
  must_change_password boolean default true,
  created_at timestamptz default now()
);

alter table public.app_users add column if not exists mobile text default '';
alter table public.app_users enable row level security;

create or replace function public.login(p_password text, p_username text)
returns table (id uuid, name text, "position" text, email text, mobile text, must_change_password boolean)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  select u.id, u.name, u.position, u.email, coalesce(u.mobile, ''), u.must_change_password
  from public.app_users u
  where u.username = p_username and u.password_hash = extensions.crypt(p_password, u.password_hash);
end;
$$;

create or replace function public.change_password(
  p_new_password text,
  p_old_password text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_users u
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      must_change_password = false
  where u.username = p_username
    and u.password_hash = extensions.crypt(p_old_password, u.password_hash);
  if not found then
    raise exception 'Current password is incorrect';
  end if;
end;
$$;

create or replace function public.create_app_user(
  p_admin_username text,
  p_new_username text,
  p_new_password text,
  p_new_name text,
  p_new_position text,
  p_new_email text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_admin_id uuid; v_new_id uuid;
begin
  select u.id into v_admin_id from public.app_users u
  where u.username = p_admin_username and u.position = 'Superuser';
  if v_admin_id is null then raise exception 'Only a superuser can create accounts'; end if;
  insert into public.app_users (username, password_hash, name, position, email, must_change_password)
  values (p_new_username, extensions.crypt(p_new_password, extensions.gen_salt('bf')), p_new_name, p_new_position, p_new_email, true)
  returning app_users.id into v_new_id;
  return v_new_id;
end;
$$;

create or replace function public.update_app_user_profile(
  p_email text, p_mobile text, p_username text
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.app_users u
  set email = coalesce(nullif(trim(p_email), ''), u.email),
      mobile = coalesce(nullif(trim(p_mobile), ''), '')
  where u.username = p_username;
  if not found then raise exception 'User not found'; end if;
end;
$$;

create or replace function public.set_my_password(
  p_new_password text, p_username text
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.app_users u
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      must_change_password = false
  where u.username = p_username;
  if not found then raise exception 'User not found'; end if;
end;
$$;

grant execute on function public.login(text, text) to anon;
grant execute on function public.change_password(text, text, text) to anon;
grant execute on function public.create_app_user(text, text, text, text, text, text) to anon;
grant execute on function public.update_app_user_profile(text, text, text) to anon;
grant execute on function public.set_my_password(text, text) to anon;

insert into public.app_users (username, password_hash, name, position, email, must_change_password)
values (
  'kevjacob',
  extensions.crypt('Brother87@', extensions.gen_salt('bf')),
  'Kelvin Sim',
  'Superuser',
  'kelvin@taisay.my',
  false
)
on conflict (username) do nothing;
