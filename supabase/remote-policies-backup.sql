-- Run this in your ONLINE Supabase SQL Editor to allow the backup script to upsert.
-- (Backup uses anon key; RLS was only allowing SELECT. This adds INSERT/UPDATE/DELETE for anon on backup tables.)

drop policy if exists "Allow anon select employees" on public.employees;
create policy "Allow all for anon" on public.employees for all to anon using (true) with check (true);

drop policy if exists "Allow anon select warehouses" on public.warehouses;
create policy "Allow all for anon" on public.warehouses for all to anon using (true) with check (true);

drop policy if exists "Allow anon select invoices" on public.invoices;
create policy "Allow all for anon" on public.invoices for all to anon using (true) with check (true);

drop policy if exists "Allow anon select invoices_autocount" on public.invoices_autocount;
create policy "Allow all for anon" on public.invoices_autocount for all to anon using (true) with check (true);

drop policy if exists "Allow anon select credit_notes" on public.credit_notes;
create policy "Allow all for anon" on public.credit_notes for all to anon using (true) with check (true);

drop policy if exists "Allow anon select grn" on public.grn;
create policy "Allow all for anon" on public.grn for all to anon using (true) with check (true);

drop policy if exists "Allow anon select delivery_orders" on public.delivery_orders;
create policy "Allow all for anon" on public.delivery_orders for all to anon using (true) with check (true);

drop policy if exists "Allow anon select announcements" on public.announcements;
create policy "Allow all for anon" on public.announcements for all to anon using (true) with check (true);

-- app_users: allow anon so backup can sync; mobile still uses login RPC only
drop policy if exists "Allow all for anon" on public.app_users;
create policy "Allow all for anon" on public.app_users for all to anon using (true) with check (true);
