-- Run once in Supabase Dashboard → SQL Editor (cloud project).
-- Site-wide maintenance mode toggle (superuser only).

create table if not exists public.maintenance_mode (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  updated_at timestamptz default now()
);

insert into public.maintenance_mode (id, enabled) values (1, false)
on conflict (id) do nothing;

alter table public.maintenance_mode enable row level security;

drop policy if exists "Allow anon to select maintenance_mode" on public.maintenance_mode;
create policy "Allow anon to select maintenance_mode"
  on public.maintenance_mode for select to anon using (true);

create or replace function public.set_maintenance_mode(
  p_enabled boolean,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users u
    where u.username = p_username and u.position = 'Superuser'
  ) then
    raise exception 'Only a superuser can change maintenance mode';
  end if;
  update public.maintenance_mode
  set enabled = p_enabled, updated_at = now()
  where id = 1;
  if not found then
    insert into public.maintenance_mode (id, enabled) values (1, p_enabled);
  end if;
end;
$$;

grant execute on function public.set_maintenance_mode(boolean, text) to anon;

-- Skip if already in publication (error is harmless).
alter publication supabase_realtime add table public.maintenance_mode;

notify pgrst, 'reload schema';
