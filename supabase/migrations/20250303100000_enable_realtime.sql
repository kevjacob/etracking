-- Enable Realtime for eTracking tables so status and other changes appear live.
-- See: https://supabase.com/docs/guides/realtime/postgres-changes

alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.invoices_autocount;
alter publication supabase_realtime add table public.credit_notes;
alter publication supabase_realtime add table public.grn;
alter publication supabase_realtime add table public.delivery_orders;
