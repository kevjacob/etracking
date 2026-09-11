-- Run in hosted Supabase SQL Editor (the same project Vercel uses).
-- Fixes: "new row violates row-level security policy for table alert_settings"

create table if not exists public.alert_settings (
  status_key text primary key,
  max_days numeric not null check (max_days >= 0)
);

alter table public.alert_settings enable row level security;

drop policy if exists "Allow anon to select alert_settings" on public.alert_settings;
drop policy if exists "Allow all for anon" on public.alert_settings;
drop policy if exists "Allow all for authenticated" on public.alert_settings;

create policy "Allow all for anon"
  on public.alert_settings for all to anon using (true) with check (true);

create policy "Allow all for authenticated"
  on public.alert_settings for all to authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.alert_settings to anon, authenticated;

notify pgrst, 'reload schema';
