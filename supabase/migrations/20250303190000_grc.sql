-- GRC (Goods Return Certificate) — same structure as GRN.
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
  created_at timestamptz default now()
);

alter table public.grc enable row level security;

drop policy if exists "Allow all for anon" on public.grc;
create policy "Allow all for anon"
  on public.grc for all to anon using (true) with check (true);

alter publication supabase_realtime add table public.grc;

notify pgrst, 'reload schema';
