import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.log("MemeLab username migration skipped: POSTGRES_URL is not available.");
  process.exit(0);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require"
});

await sql.unsafe(`
alter table public.profiles drop constraint if exists profiles_username_format_check;
alter table public.profiles add constraint profiles_username_format_check
  check (username ~ '^[A-Za-z0-9_]{3,20}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));

  if requested_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Username must be 3–20 characters using only letters, numbers, and underscores'
      using errcode = '22023';
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    requested_username,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), requested_username),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
exception
  when unique_violation then
    raise exception 'Username is already taken' using errcode = '23505';
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    candidate_username ~ '^[A-Za-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(candidate_username)
    );
$$;

revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated, service_role;
`);

await sql.end();
console.log("MemeLab username identity rules are ready.");
