-- Run once in Supabase SQL Editor (local Studio http://127.0.0.1:54323 or hosted).
-- Required for Add New GRC (linked DO on GRN + outlet column).

-- 1) GRC table
create table if not exists public.grc (
  id uuid primary key default gen_random_uuid(),
  grc_no text not null default '',
  grc_date date,
  number_and_date_locked boolean default false,
  status text not null default 'Billed',
  status_updated_at timestamptz default now(),
  assigned_driver_id uuid references public.employees(id),
  assigned_salesman_id uuid references public.employees(id),
  assigned_clerk_id uuid references public.employees(id),
  transfer_warehouse_id uuid references public.warehouses(id),
  hold_warehouse_id uuid references public.warehouses(id),
  hold_warehouse_type text default '',
  delivery_date date,
  delivery_slot text default '',
  remark text default '',
  remark_at_billed text default '',
  discrepancy jsonb default '{}',
  outlet text not null default '',
  linked_grn_id uuid references public.grn(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.grc enable row level security;

drop policy if exists "Allow all for anon" on public.grc;
create policy "Allow all for anon"
  on public.grc for all to anon using (true) with check (true);

-- 2) Columns on existing grc / grn (safe if table or column already exists)
alter table public.grc add column if not exists outlet text not null default '';
alter table public.grc add column if not exists linked_grn_id uuid references public.grn(id) on delete set null;
alter table public.grn add column if not exists linked_grc_id uuid references public.grc(id) on delete set null;

notify pgrst, 'reload schema';
