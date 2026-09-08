-- Run in Supabase SQL Editor. Default true keeps existing warehouses in Hold/Chop pickers.
alter table public.warehouses add column if not exists own boolean not null default true;

notify pgrst, 'reload schema';
