-- App users (custom auth; login via RPC). Supabase Auth not used for this app.
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

-- Add mobile if table already existed without it
alter table public.app_users add column if not exists mobile text default '';

-- RLS: no direct read/write; all access via RPCs
alter table public.app_users enable row level security;

-- No policies: anon and authenticated cannot select/insert/update app_users directly.
-- Login and create_user are done via RPCs that use SECURITY DEFINER.

-- Login: returns user id, name, position, email, must_change_password if username/password match.
-- Parameter order (p_password, p_username) matches PostgREST schema cache lookup.
create or replace function public.login(p_password text, p_username text)
returns table (id uuid, name text, "position" text, email text, mobile text, must_change_password boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.id, u.name, u.position, u.email, coalesce(u.mobile, ''), u.must_change_password
  from public.app_users u
  where u.username = p_username and u.password_hash = extensions.crypt(p_password, u.password_hash);
end;
$$;

-- Change password (required when must_change_password is true; can also be used to change password anytime)
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

-- Create new user (only superuser can create). Parameter order alphabetical for PostgREST schema cache.
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

-- Update own profile (email, mobile). Name and position are not updatable here.
create or replace function public.update_app_user_profile(
  p_email text,
  p_mobile text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_users u
  set email = coalesce(nullif(trim(p_email), ''), u.email),
      mobile = coalesce(nullif(trim(p_mobile), ''), '')
  where u.username = p_username;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

-- Set password without old password (for Update Account page; only call with own username)
create or replace function public.set_my_password(
  p_new_password text,
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
  where u.username = p_username;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

-- Grant execute to anon (login, change_password, create_user are protected by logic inside the functions)
grant execute on function public.login(text, text) to anon;
grant execute on function public.change_password(text, text, text) to anon;
grant execute on function public.create_app_user(text, text, text, text, text, text) to anon;
grant execute on function public.update_app_user_profile(text, text, text) to anon;
grant execute on function public.set_my_password(text, text) to anon;

-- List all app users (superuser only). Returns JSONB to avoid schema-cache issues with RETURNS TABLE.
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

-- Update another user (superuser only). Username is target identity and cannot be changed.
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

-- Set another user's password (superuser only; e.g. reset or set temporary)
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

-- Delete user (superuser only). Cannot delete self.
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
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

-- Grant execute to anon
grant execute on function public.list_app_users(text) to anon;
grant execute on function public.update_app_user_admin(text, text, text, text, text, text) to anon;
grant execute on function public.set_user_password_admin(text, text, text) to anon;
grant execute on function public.delete_app_user(text, text) to anon;

-- Seed: superuser kevjacob (password Brother87@)
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
