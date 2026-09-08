-- Run in Supabase SQL Editor for Lead Time Aging Report.
create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  document_no text not null default '',
  from_status text not null,
  to_status text not null,
  from_status_at timestamptz not null,
  to_status_at timestamptz not null,
  days_elapsed integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists status_history_entity_type_to_at_idx
  on public.status_history (entity_type, to_status_at desc);

create index if not exists status_history_transition_idx
  on public.status_history (entity_type, from_status, to_status, to_status_at desc);

alter table public.status_history enable row level security;

drop policy if exists "Allow all for anon" on public.status_history;
create policy "Allow all for anon"
  on public.status_history for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
