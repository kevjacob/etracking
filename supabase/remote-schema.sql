-- Run this once in your ONLINE Supabase project (SQL Editor)
-- Creates tables identical to Docker for backup/sync. No chat tables.
-- Enables anon SELECT for mobile app; backup script uses service_role.

create extension if not exists pgcrypto;

-- Employees
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  position text not null,
  name text not null,
  number text default ''
);

-- Warehouses
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  pic_name text default '',
  pic_phone text default ''
);

-- ESD Invoices (with cod)
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
  cod boolean default false,
  created_at timestamptz default now()
);

-- Autocount Invoices (with cod)
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
  cod boolean default false,
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

-- GRN
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

-- App users (for mobile login)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  name text not null default '',
  position text not null default 'Clerk',
  email text not null default '',
  mobile text default '',
  must_change_password boolean default true,
  created_at timestamptz default now()
);

-- Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text default '',
  created_at timestamptz default now()
);

-- RLS: enable on all; anon can SELECT (for mobile app). Backup uses service_role and bypasses RLS.
alter table public.employees enable row level security;
alter table public.warehouses enable row level security;
alter table public.invoices enable row level security;
alter table public.invoices_autocount enable row level security;
alter table public.credit_notes enable row level security;
alter table public.grn enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.app_users enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "Allow anon select employees" on public.employees;
create policy "Allow anon select employees" on public.employees for select to anon using (true);

drop policy if exists "Allow anon select warehouses" on public.warehouses;
create policy "Allow anon select warehouses" on public.warehouses for select to anon using (true);

drop policy if exists "Allow anon select invoices" on public.invoices;
create policy "Allow anon select invoices" on public.invoices for select to anon using (true);

drop policy if exists "Allow anon select invoices_autocount" on public.invoices_autocount;
create policy "Allow anon select invoices_autocount" on public.invoices_autocount for select to anon using (true);

drop policy if exists "Allow anon select credit_notes" on public.credit_notes;
create policy "Allow anon select credit_notes" on public.credit_notes for select to anon using (true);

drop policy if exists "Allow anon select grn" on public.grn;
create policy "Allow anon select grn" on public.grn for select to anon using (true);

drop policy if exists "Allow anon select delivery_orders" on public.delivery_orders;
create policy "Allow anon select delivery_orders" on public.delivery_orders for select to anon using (true);

drop policy if exists "Allow anon select announcements" on public.announcements;
create policy "Allow anon select announcements" on public.announcements for select to anon using (true);

-- app_users: no direct select; mobile uses login RPC only
-- (So we do not add a public SELECT policy on app_users; login RPC is SECURITY DEFINER.)

-- Login RPC for mobile app (same as Docker)
create or replace function public.login(p_password text, p_username text)
returns table (id uuid, name text, "position" text, email text, mobile text, must_change_password boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.id, u.name, u.position, u.email, coalesce(u.mobile, ''), u.must_change_password
  from public.app_users u
  where u.username = p_username and u.password_hash = extensions.crypt(p_password, u.password_hash);
end;
$$;

create or replace function public.change_password(
  p_new_password text,
  p_old_password text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_users u
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      must_change_password = false
  where u.username = p_username
    and u.password_hash = extensions.crypt(p_old_password, u.password_hash);
  if not found then
    raise exception 'Current password is incorrect';
  end if;
end;
$$;

grant execute on function public.login(text, text) to anon;
grant execute on function public.change_password(text, text, text) to anon;
