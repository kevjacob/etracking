-- Link GRC rows to GRN (DO) rows for status sync.
-- Run in Supabase SQL Editor, then: notify pgrst, 'reload schema';
-- Or use supabase/RUN_GRC_FULL.sql for full GRC setup in one script.

alter table public.grc add column if not exists linked_grn_id uuid references public.grn(id) on delete set null;
alter table public.grn add column if not exists linked_grc_id uuid references public.grc(id) on delete set null;

notify pgrst, 'reload schema';