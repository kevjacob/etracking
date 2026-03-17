create or replace function public.list_app_users(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.app_users u
    where u.username = p_username and u.position = 'Superuser'
  ) then
    raise exception 'Only a superuser can list accounts';
  end if;
  select coalesce(
    (select jsonb_agg(row_to_json(t)::jsonb)
     from (
       select u.id, u.username, u.name, u.position, u.email, coalesce(u.mobile, '') as mobile
       from public.app_users u
       order by u.username
     ) t),
    '[]'::jsonb
  ) into result;
  return result;
end;
$$;

grant execute on function public.list_app_users(text) to anon;