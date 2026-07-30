import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.log("MemeLab community expansion skipped: POSTGRES_URL is not available.");
  process.exit(0);
}

const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: "require" });

await sql.unsafe(`
alter table public.account_settings
  add column if not exists show_online_status boolean not null default true,
  add column if not exists message_permission text not null default 'everyone';

alter table public.account_settings
  drop constraint if exists account_settings_message_permission_check;
alter table public.account_settings
  add constraint account_settings_message_permission_check
  check (message_permission in ('everyone', 'interactions', 'nobody'));

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;
drop policy if exists "Members read their blocks" on public.user_blocks;
create policy "Members read their blocks" on public.user_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
drop policy if exists "Members create their blocks" on public.user_blocks;
create policy "Members create their blocks" on public.user_blocks
  for insert to authenticated
  with check ((select auth.uid()) = blocker_id and public.is_active_member());
drop policy if exists "Members remove their blocks" on public.user_blocks;
create policy "Members remove their blocks" on public.user_blocks
  for delete to authenticated using ((select auth.uid()) = blocker_id);
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;

alter table public.posts
  add column if not exists post_kind text not null default 'image',
  add column if not exists channel_slug text;
alter table public.posts alter column image_url drop not null;
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check
  check (post_kind in ('image', 'discussion'));
alter table public.posts drop constraint if exists posts_channel_check;
alter table public.posts add constraint posts_channel_check
  check (channel_slug is null or channel_slug in ('general', 'meme-talk', 'studio-help', 'ideas', 'off-topic'));
alter table public.posts drop constraint if exists posts_content_shape_check;
alter table public.posts add constraint posts_content_shape_check check (
  (post_kind = 'image' and image_url is not null and channel_slug is null)
  or
  (post_kind = 'discussion' and image_url is null and channel_slug is not null)
);
create index if not exists posts_discussion_channel_idx
  on public.posts (post_kind, channel_slug, status, created_at desc);

drop function if exists public.get_community_stats();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.notify_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  notification_type text;
  post_title text;
begin
  if new.status <> 'active' or new.author_id is null then return new; end if;

  if new.parent_id is not null then
    select author_id into recipient_id from public.comments where id = new.parent_id;
    notification_type := 'reply';
  else
    select author_id, title into recipient_id, post_title from public.posts where id = new.post_id;
    notification_type := 'comment';
  end if;

  if recipient_id is null or recipient_id = new.author_id then return new; end if;
  if exists (
    select 1 from public.account_settings
    where user_id = recipient_id and notification_replies = false
  ) then return new; end if;

  insert into public.notifications (user_id, actor_id, post_id, comment_id, type, message)
  values (
    recipient_id, new.author_id, new.post_id, new.id, notification_type,
    case when notification_type = 'reply'
      then 'replied to your comment'
      else 'commented on ' || coalesce(post_title, 'your post')
    end
  );
  return new;
end;
$$;
revoke execute on function private.notify_comment_activity() from public, anon, authenticated;

drop trigger if exists comments_create_notification on public.comments;
create trigger comments_create_notification
  after insert on public.comments
  for each row execute procedure private.notify_comment_activity();
`);

await sql.end();
console.log("MemeLab community expansion is ready.");
