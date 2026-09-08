-- Outlet name column on GRC (shown in GRC tracking list).
alter table public.grc add column if not exists outlet text not null default '';

notify pgrst, 'reload schema';
