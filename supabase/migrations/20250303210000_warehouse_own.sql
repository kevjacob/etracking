-- Own warehouse flag: only "own" warehouses appear in Hold-Warehouse / Chop & Sign - Warehouse pickers.
alter table public.warehouses add column if not exists own boolean not null default true;

notify pgrst, 'reload schema';
