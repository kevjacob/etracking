-- Run in Supabase SQL Editor (hosted) OR local Studio: http://127.0.0.1:54323 → SQL.

create table if not exists public.idt (
  id uuid primary key default gen_random_uuid(),
  idt_no text not null default '',
  idt_date date,
  from_warehouse_id uuid references public.warehouses(id),
  to_warehouse_id uuid references public.warehouses(id),
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

alter table public.idt enable row level security;

drop policy if exists "Allow all for anon" on public.idt;
create policy "Allow all for anon"
  on public.idt for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
