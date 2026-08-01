import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.log("MemeLab social layer skipped: POSTGRES_URL is not available.");
  process.exit(0);
}

const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: "require" });

await sql.unsafe(`
alter table public.account_settings
  add column if not exists notification_social boolean not null default true,
  add column if not exists notification_messages boolean not null default true;

alter table public.profiles
  add column if not exists friend_count integer not null default 0;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  member_one_id uuid not null references public.profiles(id) on delete cascade,
  member_two_id uuid not null references public.profiles(id) on delete cascade,
  requested_by_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (member_one_id < member_two_id),
  check (requested_by_id = member_one_id or requested_by_id = member_two_id),
  unique (member_one_id, member_two_id)
);
create index if not exists friendships_member_one_idx on public.friendships (member_one_id, status, updated_at desc);
create index if not exists friendships_member_two_idx on public.friendships (member_two_id, status, updated_at desc);
create index if not exists friendships_requested_by_idx on public.friendships (requested_by_id, status, updated_at desc);

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  member_one_id uuid not null references public.profiles(id) on delete cascade,
  member_two_id uuid not null references public.profiles(id) on delete cascade,
  created_by_id uuid not null references public.profiles(id) on delete restrict,
  member_one_last_read_at timestamptz,
  member_two_last_read_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_one_id < member_two_id),
  check (created_by_id = member_one_id or created_by_id = member_two_id),
  unique (member_one_id, member_two_id)
);
create index if not exists direct_conversations_member_one_idx on public.direct_conversations (member_one_id, last_message_at desc nulls last);
create index if not exists direct_conversations_member_two_idx on public.direct_conversations (member_two_id, last_message_at desc nulls last);
create index if not exists direct_conversations_created_by_idx on public.direct_conversations (created_by_id, created_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_conversation_idx on public.direct_messages (conversation_id, created_at asc);
create index if not exists direct_messages_sender_rate_idx on public.direct_messages (sender_id, created_at desc);

alter table public.notifications
  add column if not exists conversation_id uuid references public.direct_conversations(id) on delete cascade;
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('comment', 'reply', 'mention', 'milestone', 'moderation', 'friend_request', 'friend_accepted', 'direct_message'));
create index if not exists notifications_conversation_idx on public.notifications (conversation_id, created_at desc)
  where conversation_id is not null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.recalculate_friend_count(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_profile_id is null then
    return;
  end if;

  update public.profiles
  set friend_count = (
    select count(*)::integer
    from public.friendships
    where status = 'accepted'
      and (member_one_id = target_profile_id or member_two_id = target_profile_id)
  )
  where id = target_profile_id;
end;
$$;
revoke all on function private.recalculate_friend_count(uuid) from public, anon, authenticated;

create or replace function private.refresh_friend_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalculate_friend_count(old.member_one_id);
    perform private.recalculate_friend_count(old.member_two_id);
    return old;
  end if;

  perform private.recalculate_friend_count(new.member_one_id);
  perform private.recalculate_friend_count(new.member_two_id);
  return new;
end;
$$;
revoke all on function private.refresh_friend_counts() from public, anon, authenticated;

drop trigger if exists friendships_refresh_counts on public.friendships;
create trigger friendships_refresh_counts
after insert or update or delete on public.friendships
for each row execute procedure private.refresh_friend_counts();

create or replace function private.touch_direct_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.direct_conversations
  set
    last_message_at = new.created_at,
    last_message_preview = left(regexp_replace(new.body, '\\s+', ' ', 'g'), 140)
  where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function private.touch_direct_conversation() from public, anon, authenticated;

drop trigger if exists direct_messages_touch_conversation on public.direct_messages;
create trigger direct_messages_touch_conversation
after insert on public.direct_messages
for each row execute procedure private.touch_direct_conversation();

create or replace function private.notify_friendship_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  actor_id uuid;
  notice_type text;
  notice_message text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    recipient_id := case when new.requested_by_id = new.member_one_id then new.member_two_id else new.member_one_id end;
    actor_id := new.requested_by_id;
    notice_type := 'friend_request';
    notice_message := 'sent you a friend request';
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    recipient_id := new.requested_by_id;
    actor_id := case when new.requested_by_id = new.member_one_id then new.member_two_id else new.member_one_id end;
    notice_type := 'friend_accepted';
    notice_message := 'accepted your friend request';
  else
    return new;
  end if;

  if exists (
    select 1 from public.account_settings
    where user_id = recipient_id and notification_social = false
  ) then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, message)
  values (recipient_id, actor_id, notice_type, notice_message);
  return new;
end;
$$;
revoke all on function private.notify_friendship_activity() from public, anon, authenticated;

drop trigger if exists friendships_create_notification on public.friendships;
create trigger friendships_create_notification
after insert or update on public.friendships
for each row execute procedure private.notify_friendship_activity();

create or replace function private.remove_friendship_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where (member_one_id = new.blocker_id and member_two_id = new.blocked_id)
     or (member_one_id = new.blocked_id and member_two_id = new.blocker_id);
  return new;
end;
$$;
revoke all on function private.remove_friendship_on_block() from public, anon, authenticated;

drop trigger if exists user_blocks_remove_friendship on public.user_blocks;
create trigger user_blocks_remove_friendship
after insert on public.user_blocks
for each row execute procedure private.remove_friendship_on_block();

create or replace function private.validate_direct_message_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.direct_conversations
    where id = new.conversation_id
      and (member_one_id = new.sender_id or member_two_id = new.sender_id)
  ) then
    raise exception 'Message sender must belong to this conversation.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_direct_message_sender() from public, anon, authenticated;

drop trigger if exists direct_messages_validate_sender on public.direct_messages;
create trigger direct_messages_validate_sender
before insert on public.direct_messages
for each row execute procedure private.validate_direct_message_sender();

create or replace function private.notify_direct_message_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  select case when conversation.member_one_id = new.sender_id then conversation.member_two_id else conversation.member_one_id end
  into recipient_id
  from public.direct_conversations as conversation
  where conversation.id = new.conversation_id;

  if recipient_id is null or recipient_id = new.sender_id then
    return new;
  end if;
  if exists (
    select 1 from public.account_settings
    where user_id = recipient_id and notification_messages = false
  ) then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, conversation_id, type, message)
  values (recipient_id, new.sender_id, new.conversation_id, 'direct_message', 'sent you a message');
  return new;
end;
$$;
revoke all on function private.notify_direct_message_activity() from public, anon, authenticated;

drop trigger if exists direct_messages_create_notification on public.direct_messages;
create trigger direct_messages_create_notification
after insert on public.direct_messages
for each row execute procedure private.notify_direct_message_activity();

create or replace function public.enforce_direct_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.direct_messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'Messaging limit reached. Please wait a minute before sending more.';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_direct_message_rate_limit() from public, anon, authenticated;

drop trigger if exists direct_messages_rate_limit on public.direct_messages;
create trigger direct_messages_rate_limit
before insert on public.direct_messages
for each row execute procedure public.enforce_direct_message_rate_limit();

create or replace function public.can_send_direct_message(sender_id uuid, recipient_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    sender_id is not null
    and recipient_id is not null
    and sender_id <> recipient_id
    and exists (select 1 from public.profiles where id = sender_id and account_status = 'active')
    and exists (select 1 from public.profiles where id = recipient_id and account_status = 'active')
    and not exists (
      select 1 from public.user_blocks
      where (blocker_id = sender_id and blocked_id = recipient_id)
         or (blocker_id = recipient_id and blocked_id = sender_id)
    )
    and (
      coalesce((select message_permission from public.account_settings where user_id = recipient_id), 'everyone') = 'everyone'
      or (
        coalesce((select message_permission from public.account_settings where user_id = recipient_id), 'everyone') = 'interactions'
        and (
          exists (
            select 1 from public.friendships
            where status = 'accepted'
              and ((member_one_id = sender_id and member_two_id = recipient_id)
                or (member_one_id = recipient_id and member_two_id = sender_id))
          )
          or exists (
            select 1
            from public.comments as comment
            join public.posts as post on post.id = comment.post_id
            where comment.status = 'active'
              and post.status = 'active'
              and ((comment.author_id = sender_id and post.author_id = recipient_id)
                or (comment.author_id = recipient_id and post.author_id = sender_id))
          )
          or exists (
            select 1
            from public.comments as reply
            join public.comments as parent on parent.id = reply.parent_id
            where reply.status = 'active'
              and parent.status = 'active'
              and ((reply.author_id = sender_id and parent.author_id = recipient_id)
                or (reply.author_id = recipient_id and parent.author_id = sender_id))
          )
        )
      )
    );
$$;
revoke all on function public.can_send_direct_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_send_direct_message(uuid, uuid) to service_role;

alter table public.friendships enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "Members read their friendships" on public.friendships;
create policy "Members read their friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) = member_one_id or (select auth.uid()) = member_two_id);

drop policy if exists "Members read their direct conversations" on public.direct_conversations;
create policy "Members read their direct conversations" on public.direct_conversations
  for select to authenticated
  using ((select auth.uid()) = member_one_id or (select auth.uid()) = member_two_id);

drop policy if exists "Members read their direct messages" on public.direct_messages;
create policy "Members read their direct messages" on public.direct_messages
  for select to authenticated
  using (exists (
    select 1 from public.direct_conversations
    where id = conversation_id
      and ((select auth.uid()) = member_one_id or (select auth.uid()) = member_two_id)
  ));

revoke all on public.friendships, public.direct_conversations, public.direct_messages from anon, authenticated;
grant select on public.friendships, public.direct_conversations, public.direct_messages to authenticated;
grant all on public.friendships, public.direct_conversations, public.direct_messages to service_role;

drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at before update on public.friendships
for each row execute procedure public.touch_updated_at();
drop trigger if exists direct_conversations_touch_updated_at on public.direct_conversations;
create trigger direct_conversations_touch_updated_at before update on public.direct_conversations
for each row execute procedure public.touch_updated_at();

select private.recalculate_friend_count(id) from public.profiles;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.direct_messages;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;
`);

await sql.end();
console.log("MemeLab social layer is ready.");
