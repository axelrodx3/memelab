import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.log("MemeLab account center migration skipped: POSTGRES_URL is not available.");
  process.exit(0);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require"
});

await sql.unsafe(`
alter table public.profiles
  add column if not exists banner_url text,
  add column if not exists username_changed_at timestamptz,
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists show_activity boolean not null default true,
  add column if not exists account_status text not null default 'active',
  add column if not exists deactivated_at timestamptz;

alter table public.profiles drop constraint if exists profiles_display_name_length_check;
alter table public.profiles add constraint profiles_display_name_length_check
  check (display_name is null or char_length(display_name) between 1 and 50);
alter table public.profiles drop constraint if exists profiles_bio_length_check;
alter table public.profiles add constraint profiles_bio_length_check
  check (char_length(bio) <= 240);
alter table public.profiles drop constraint if exists profiles_visibility_check;
alter table public.profiles add constraint profiles_visibility_check
  check (profile_visibility in ('public', 'private'));
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'deactivated'));

create table if not exists public.account_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gender text,
  visibility_before_deactivation text not null default 'public',
  notification_email boolean not null default true,
  notification_replies boolean not null default true,
  notification_votes boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gender is null or gender in ('female', 'male'))
);

alter table public.account_settings
  add column if not exists visibility_before_deactivation text not null default 'public';
alter table public.account_settings drop constraint if exists account_settings_visibility_before_deactivation_check;
alter table public.account_settings add constraint account_settings_visibility_before_deactivation_check
  check (visibility_before_deactivation in ('public', 'private'));

create table if not exists public.template_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id text not null references public.template_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);
create index if not exists template_favorites_user_created_idx
  on public.template_favorites (user_id, created_at desc);
create index if not exists template_favorites_template_idx
  on public.template_favorites (template_id);

insert into public.account_settings (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.account_settings enable row level security;
drop policy if exists "Members read their account settings" on public.account_settings;
create policy "Members read their account settings" on public.account_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Members update their account settings" on public.account_settings;
create policy "Members update their account settings" on public.account_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, update on public.account_settings to authenticated;
grant all on public.account_settings to service_role;

alter table public.template_favorites enable row level security;
drop policy if exists "Visible template favorites are public" on public.template_favorites;
create policy "Visible template favorites are public" on public.template_favorites
  for select using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles
      where id = user_id
        and account_status = 'active'
        and profile_visibility = 'public'
        and show_activity
    )
  );
drop policy if exists "Members save template favorites" on public.template_favorites;
create policy "Members save template favorites" on public.template_favorites
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_active_member());
drop policy if exists "Members remove template favorites" on public.template_favorites;
create policy "Members remove template favorites" on public.template_favorites
  for delete to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.template_favorites to anon, authenticated;
grant insert, delete on public.template_favorites to authenticated;
grant all on public.template_favorites to service_role;

create or replace function public.is_reserved_username(candidate_username text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select lower(candidate_username) = any (
    array[
      'admin', 'administrator', 'api', 'help', 'memelab', 'mod', 'moderator',
      'official', 'root', 'security', 'staff', 'support', 'system', 'www'
    ]
  );
$$;

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    candidate_username ~ '^[A-Za-z0-9_]{3,20}$'
    and not public.is_reserved_username(candidate_username)
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(candidate_username)
    );
$$;

revoke execute on function public.is_reserved_username(text) from public;
grant execute on function public.is_reserved_username(text) to anon, authenticated, service_role;
revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated, service_role;

create or replace function public.enforce_profile_identity_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    if public.is_reserved_username(new.username) then
      raise exception 'That username is reserved' using errcode = '23514';
    end if;
    if old.username_changed_at is not null
      and old.username_changed_at > now() - interval '30 days' then
      raise exception 'Username can only be changed once every 30 days' using errcode = 'P0001';
    end if;
    new.username_changed_at := now();
  end if;

  if new.account_status = 'deactivated' and old.account_status <> 'deactivated' then
    new.deactivated_at := now();
    new.profile_visibility := 'private';
  elsif new.account_status = 'active' and old.account_status = 'deactivated' then
    new.deactivated_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_identity_update on public.profiles;
create trigger profiles_enforce_identity_update
  before update on public.profiles
  for each row execute procedure public.enforce_profile_identity_update();
revoke execute on function public.enforce_profile_identity_update() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_username text;
  requested_gender text;
  default_avatar text;
begin
  requested_username := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  requested_gender := lower(btrim(coalesce(new.raw_user_meta_data ->> 'gender', '')));

  if requested_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Username must be 3–20 characters using only letters, numbers, and underscores'
      using errcode = '22023';
  end if;
  if public.is_reserved_username(requested_username) then
    raise exception 'That username is reserved' using errcode = '23514';
  end if;
  if requested_gender not in ('female', 'male') then
    raise exception 'Choose Female or Male to create an account' using errcode = '22023';
  end if;

  default_avatar := case requested_gender
    when 'female' then '/avatars/default-female.png'
    else '/avatars/default-male.png'
  end;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    requested_username,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), requested_username),
    default_avatar
  )
  on conflict (id) do nothing;

  insert into public.account_settings (user_id, gender)
  values (new.id, requested_gender)
  on conflict (user_id) do update set gender = excluded.gender;

  return new;
exception
  when unique_violation then
    raise exception 'Username is already taken' using errcode = '23505';
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.touch_account_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists account_settings_touch_updated_at on public.account_settings;
create trigger account_settings_touch_updated_at
  before update on public.account_settings
  for each row execute procedure public.touch_account_settings_updated_at();
revoke execute on function public.touch_account_settings_updated_at() from public, anon, authenticated;

revoke insert, update, delete on public.profiles from authenticated;
grant update (
  username, display_name, avatar_url, banner_url, bio, mature_content_enabled,
  profile_visibility, show_activity, account_status, deactivated_at
) on public.profiles to authenticated;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and account_status = 'active'
  );
$$;
revoke execute on function public.is_active_member() from public;
grant execute on function public.is_active_member() to authenticated, service_role;

alter function public.is_moderator() security invoker;
alter function public.is_moderator() set search_path = '';

drop policy if exists "Members create posts" on public.posts;
create policy "Members create posts" on public.posts for insert to authenticated
with check ((select auth.uid()) = author_id and public.is_active_member());
drop policy if exists "Members create votes" on public.post_votes;
create policy "Members create votes" on public.post_votes for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_active_member());
drop policy if exists "Members create comments" on public.comments;
create policy "Members create comments" on public.comments for insert to authenticated
with check ((select auth.uid()) = author_id and public.is_active_member());
drop policy if exists "Members create comment votes" on public.comment_votes;
create policy "Members create comment votes" on public.comment_votes for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_active_member());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members read their avatar files" on storage.objects;
create policy "Members read their avatar files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);
drop policy if exists "Members upload avatar files" on storage.objects;
create policy "Members upload avatar files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_member()
  );
drop policy if exists "Members update avatar files" on storage.objects;
create policy "Members update avatar files" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text)
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Members delete avatar files" on storage.objects;
create policy "Members delete avatar files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);

alter function public.touch_updated_at() set search_path = '';
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.refresh_post_vote_counts() from public, anon, authenticated;
revoke execute on function public.refresh_comment_vote_counts() from public, anon, authenticated;
revoke execute on function public.recalculate_profile_karma(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_profile_karma_from_post() from public, anon, authenticated;
revoke execute on function public.refresh_profile_karma_from_comment() from public, anon, authenticated;
revoke execute on function public.refresh_post_comment_count() from public, anon, authenticated;
revoke execute on function public.enforce_post_rate_limit() from public, anon, authenticated;
revoke execute on function public.enforce_comment_rate_limit() from public, anon, authenticated;

drop policy if exists "Members read their reports" on public.reports;
create policy "Members read their reports" on public.reports
  for select to authenticated using ((select auth.uid()) = reporter_id);

create index if not exists comments_author_id_idx on public.comments(author_id);
create index if not exists comments_parent_id_idx on public.comments(parent_id);
create index if not exists post_votes_user_id_idx on public.post_votes(user_id);
create index if not exists comment_votes_user_id_idx on public.comment_votes(user_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists reports_post_id_idx on public.reports(post_id);
create index if not exists reports_comment_id_idx on public.reports(comment_id);
create index if not exists notifications_actor_id_idx on public.notifications(actor_id);
create index if not exists notifications_post_id_idx on public.notifications(post_id);
create index if not exists notifications_comment_id_idx on public.notifications(comment_id);
create index if not exists moderation_actions_moderator_id_idx on public.moderation_actions(moderator_id);
create index if not exists moderation_actions_target_user_id_idx on public.moderation_actions(target_user_id);
create index if not exists moderation_actions_post_id_idx on public.moderation_actions(post_id);
create index if not exists moderation_actions_comment_id_idx on public.moderation_actions(comment_id);
`);

await sql.end();
console.log("MemeLab account center is ready.");
