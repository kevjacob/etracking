-- Run this in your ONLINE Supabase SQL Editor to add chat (table + RPCs).
-- Run once. Then run remote-policies-chat.sql so backup can sync chat_messages.

-- Chat messages (one global room; includes optional attachment columns)
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  username text not null,
  name text not null default '',
  content text not null default '',
  attachment_filename text default null,
  attachment_content_type text default null,
  attachment_content bytea default null,
  created_at timestamptz default now()
);

create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at);

alter table public.chat_messages enable row level security;

-- Policy so backup can upsert and app can read/write (run remote-policies-chat.sql for "Allow all for anon")
drop policy if exists "Allow anon to select chat_messages" on public.chat_messages;
create policy "Allow all for anon" on public.chat_messages for all to anon using (true) with check (true);

-- Insert message (optional attachment as base64)
create or replace function public.insert_chat_message(
  p_username text,
  p_content text,
  p_attachment_base64 text default null,
  p_attachment_filename text default null,
  p_attachment_content_type text default null
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
  v_content bytea;
  v_size bigint;
begin
  select u.id, coalesce(nullif(trim(u.name), ''), u.username) into v_user_id, v_name
  from public.app_users u
  where u.username = p_username;
  if v_user_id is null then
    raise exception 'User not found';
  end if;

  if p_attachment_base64 is not null and nullif(trim(p_attachment_base64), '') is not null then
    v_content := decode(p_attachment_base64, 'base64');
    v_size := octet_length(v_content);
    if v_size > 5 * 1024 * 1024 then
      raise exception 'Attachment too large (max 5MB)';
    end if;
  end if;

  insert into public.chat_messages (user_id, username, name, content, attachment_filename, attachment_content_type, attachment_content)
  values (
    v_user_id,
    p_username,
    v_name,
    coalesce(nullif(trim(p_content), ''), ''),
    nullif(trim(p_attachment_filename), ''),
    nullif(trim(p_attachment_content_type), ''),
    v_content
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Get one message's attachment for download/view
create or replace function public.get_chat_attachment(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content bytea;
  v_filename text;
  v_type text;
begin
  select attachment_content, attachment_filename, attachment_content_type
  into v_content, v_filename, v_type
  from public.chat_messages
  where id = p_message_id;
  if v_content is null then
    return jsonb_build_object('content_base64', null, 'filename', v_filename, 'content_type', v_type);
  end if;
  return jsonb_build_object(
    'content_base64', encode(v_content, 'base64'),
    'filename', v_filename,
    'content_type', v_type
  );
end;
$$;

grant execute on function public.insert_chat_message(text, text, text, text, text) to anon;
grant execute on function public.get_chat_attachment(uuid) to anon;
