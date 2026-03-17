-- Add sender display name to chat_messages
alter table public.chat_messages add column if not exists name text not null default '';

-- Update RPC to set name from app_users when inserting
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