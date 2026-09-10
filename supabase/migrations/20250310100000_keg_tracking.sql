-- Keg Tracking: outlets, warehouse↔outlet movements, and Tenun stock entries.
create table if not exists public.keg_outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create unique index if not exists keg_outlets_name_lower_idx
  on public.keg_outlets (lower(name));

create table if not exists public.keg_movements (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null default '',
  entry_date date,
  movement_type text not null default 'dispatch',
  warehouse_id uuid references public.warehouses(id) on delete set null,
  warehouse_name text default '',
  outlet_id uuid references public.keg_outlets(id) on delete set null,
  outlet_name text default '',
  remark text default '',
  items jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists public.keg_stock_entries (
  id uuid primary key default gen_random_uuid(),
  brand text not null default '',
  entry_type text not null default 'receive',
  entry_date date,
  doc_no text not null default '',
  warehouse_name text not null default 'Tenun',
  return_to text default '',
  reference_no text default '',
  sku text not null default '',
  quantity integer not null default 0,
  created_at timestamptz default now()
);

alter table public.keg_outlets enable row level security;
alter table public.keg_movements enable row level security;
alter table public.keg_stock_entries enable row level security;

drop policy if exists "Allow all for anon" on public.keg_outlets;
create policy "Allow all for anon"
  on public.keg_outlets for all to anon using (true) with check (true);

drop policy if exists "Allow all for anon" on public.keg_movements;
create policy "Allow all for anon"
  on public.keg_movements for all to anon using (true) with check (true);

drop policy if exists "Allow all for anon" on public.keg_stock_entries;
create policy "Allow all for anon"
  on public.keg_stock_entries for all to anon using (true) with check (true);

alter publication supabase_realtime add table public.keg_outlets;
alter publication supabase_realtime add table public.keg_movements;
alter publication supabase_realtime add table public.keg_stock_entries;

notify pgrst, 'reload schema';
