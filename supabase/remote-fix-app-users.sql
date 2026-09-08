-- Run this in your ONLINE Supabase SQL Editor once.
-- Fixes: app_users had RLS but no policy, so backup couldn't sync and Table Editor may show no rows.
-- This adds the policy so anon (and backup) can read/write app_users.
--
-- If Account Management password/delete fails with "function ... not in schema cache",
-- also run: supabase/remote-fix-app-users-admin-rpcs.sql

drop policy if exists "Allow all for anon" on public.app_users;
create policy "Allow all for anon" on public.app_users for all to anon using (true) with check (true);
