-- Run in Supabase SQL Editor if chat doesn't work (table or RPC missing).
-- Then run: NOTIFY pgrst, 'reload schema';

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  username text not null,
  name text not null default '',
  content text not null default '',
  created_at timestamptz default now()
);

create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Allow anon to select chat_messages" on public.chat_messages;
create policy "Allow anon to select chat_messages"
  on public.chat_messages for select to anon using (true);

create or replace function public.insert_chat_message(
  p_username text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid;
  v_name text;
begin
  select u.id, coalesce(nullif(trim(u.name), ''), u.username) into v_user_id, v_name
  from public.app_users u
  where u.username = p_username;
  if v_user_id is null then
    raise exception 'User not found';
  end if;
  insert into public.chat_messages (user_id, username, name, content)
  values (v_user_id, p_username, v_name, coalesce(nullif(trim(p_content), ''), ''))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.insert_chat_message(text, text) to anon;

-- Realtime: run once; if you get "already in publication", ignore and run NOTIFY below
alter publication supabase_realtime add table public.chat_messages;

notify pgrst, 'reload schema';
