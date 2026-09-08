-- Run in Supabase SQL Editor. Listing/saving use direct table access (no RPC).
-- Then: NOTIFY pgrst, 'reload schema';

create table if not exists public.alert_settings (
  status_key text primary key,
  max_days numeric not null check (max_days >= 0)
);

alter table public.alert_settings enable row level security;

drop policy if exists "Allow anon to select alert_settings" on public.alert_settings;
drop policy if exists "Allow all for anon" on public.alert_settings;

create policy "Allow all for anon"
  on public.alert_settings for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
