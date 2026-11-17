-- Who made each status change, shown in View Update History.
alter table public.status_history
  add column if not exists edited_by text not null default '';

create index if not exists status_history_entity_idx
  on public.status_history (entity_type, entity_id, to_status_at asc);

notify pgrst, 'reload schema';
