-- eTracking tables for Supabase. Run with: npx supabase start

-- Employees (referenced by invoices, credit_notes, grn, delivery_orders)
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  position text not null,
  name text not null,
  number text default ''
);

-- Warehouses (referenced by invoices, credit_notes, grn, delivery_orders)
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  pic_name text default '',
  pic_phone text default ''
);

-- ESD Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null default '',
  date_of_invoice date,
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

-- Autocount Invoices (separate listing)
create table if not exists public.invoices_autocount (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null default '',
  date_of_invoice date,
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

-- Credit Notes
create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_no text not null default '',
  credit_note_date date,
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

-- GRN (Goods Received Note)
create table if not exists public.grn (
  id uuid primary key default gen_random_uuid(),
  grn_no text not null default '',
  grn_date date,
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

-- Delivery Orders
create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  delivery_order_no text not null default '',
  delivery_order_date date,
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

-- RLS: enable but allow all for anon (local / dev). Tighten for production.
alter table public.employees enable row level security;
alter table public.warehouses enable row level security;
alter table public.invoices enable row level security;
alter table public.invoices_autocount enable row level security;
alter table public.credit_notes enable row level security;
alter table public.grn enable row level security;
alter table public.delivery_orders enable row level security;

create policy "Allow all for anon" on public.employees for all to anon using (true) with check (true);
create policy "Allow all for anon" on public.warehouses for all to anon using (true) with check (true);
create policy "Allow all for anon" on public.invoices for all to anon using (true) with check (true);
create policy "Allow all for anon" on public.invoices_autocount for all to anon using (true) with check (true);
create policy "Allow all for anon" on public.credit_notes for all to anon using (true) with check (true);
create policy "Allow all for anon" on public.grn for all to anon using (true) with check (true);
create policy "Allow all for anon" on public.delivery_orders for all to anon using (true) with check (true);
