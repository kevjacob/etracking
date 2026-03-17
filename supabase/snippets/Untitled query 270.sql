-- Run in Supabase SQL Editor. Listing uses direct table select (no list_announcements RPC).
-- Then: NOTIFY pgrst, 'reload schema';

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text default '',
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;

-- Allow anon to read announcements (list). Create/update/delete stay in RPCs (superuser-only).
drop policy if exists "Allow anon to select announcements" on public.announcements;
create policy "Allow anon to select announcements"
  on public.announcements for select to anon using (true);

-- Ensure anon can see the table in the API
grant usage on schema public to anon;
grant select on public.announcements to anon;

create or replace function public.create_announcement(
  p_body text,
  p_title text,
  p_username text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.app_users u where u.username = p_username and u.position = 'Superuser') then
    raise exception 'Only a superuser can create announcements';
  end if;
  insert into public.announcements (title, body)
  values (coalesce(nullif(trim(p_title), ''), ''), coalesce(trim(p_body), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_announcement(
  p_body text,
  p_id uuid,
  p_title text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.app_users u where u.username = p_username and u.position = 'Superuser') then
    raise exception 'Only a superuser can update announcements';
  end if;
  update public.announcements
  set title = coalesce(nullif(trim(p_title), ''), title),
      body = coalesce(trim(p_body), body)
  where id = p_id;
  if not found then
    raise exception 'Announcement not found';
  end if;
end;
$$;

create or replace function public.delete_announcement(
  p_id uuid,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.app_users u where u.username = p_username and u.position = 'Superuser') then
    raise exception 'Only a superuser can delete announcements';
  end if;
  delete from public.announcements where id = p_id;
end;
$$;

grant execute on function public.create_announcement(text, text, text) to anon;
grant execute on function public.update_announcement(text, uuid, text, text) to anon;
grant execute on function public.delete_announcement(uuid, text) to anon;

notify pgrst, 'reload schema';
