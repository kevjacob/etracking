-- 1) Daily wipe of chat history at 12am (UTC). Adjust cron for your timezone (e.g. 16 = 12am UTC+8).
-- 2) Chat attachments: PDF, JPEG etc. stored in DB; wiped with history.

create extension if not exists pg_cron;

-- Add attachment columns to chat_messages
alter table public.chat_messages add column if not exists attachment_filename text default null;
alter table public.chat_messages add column if not exists attachment_content_type text default null;
alter table public.chat_messages add column if not exists attachment_content bytea default null;

-- Max attachment size 5MB
create or replace function public.wipe_chat_history()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages;
end;
$$;

-- Schedule daily at midnight UTC. For 12am in Malaysia (UTC+8) use '0 16 * * *'.
-- Enable pg_cron in Supabase Dashboard → Database → Extensions if needed.
select cron.schedule(
  'wipe-chat-daily',
  '0 0 * * *',
  'select public.wipe_chat_history()'
);

-- Replace insert_chat_message to accept optional attachment (base64)
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

-- Get one message's attachment for download/view (returns base64 so client can blob)
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

grant execute on function public.wipe_chat_history() to service_role;
grant execute on function public.insert_chat_message(text, text, text, text, text) to anon;
grant execute on function public.get_chat_attachment(uuid) to anon;
