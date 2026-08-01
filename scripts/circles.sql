create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,30}$'),
  name text not null check (char_length(name) between 3 and 48),
  description text not null default '' check (char_length(description) <= 360),
  member_count integer not null default 1 check (member_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists circles_owner_idx on public.circles(owner_id, created_at desc);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'banned')),
  invited_by_id uuid references public.profiles(id) on delete set null,
  muted_until timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index if not exists circle_members_user_idx on public.circle_members(user_id, status, updated_at desc);
create index if not exists circle_members_circle_idx on public.circle_members(circle_id, status, role, joined_at asc);
create index if not exists circle_members_inviter_idx on public.circle_members(invited_by_id);

create table if not exists public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (id, circle_id)
);
create unique index if not exists circle_invites_pending_unique
  on public.circle_invites(circle_id, invited_user_id) where status = 'pending';
create index if not exists circle_invites_recipient_idx on public.circle_invites(invited_user_id, status, created_at desc);
create index if not exists circle_invites_circle_idx on public.circle_invites(circle_id, status, created_at desc);
create index if not exists circle_invites_inviter_idx on public.circle_invites(invited_by_id);

create table if not exists public.circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 4000),
  status text not null default 'active' check (status in ('active', 'removed')),
  vote_score integer not null default 0,
  comments_count integer not null default 0 check (comments_count >= 0),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists circle_posts_feed_idx on public.circle_posts(circle_id, status, is_pinned desc, created_at desc);
create index if not exists circle_posts_author_idx on public.circle_posts(author_id, created_at desc);

create table if not exists public.circle_post_votes (
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists circle_post_votes_user_idx on public.circle_post_votes(user_id, created_at desc);

create table if not exists public.circle_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists circle_comments_post_idx on public.circle_comments(post_id, created_at asc);
create index if not exists circle_comments_author_idx on public.circle_comments(author_id);

create or replace function private.is_current_circle_member(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members
    where circle_id = target_circle_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;
grant usage on schema private to authenticated, service_role;
revoke all on function private.is_current_circle_member(uuid) from public, anon, authenticated;
grant execute on function private.is_current_circle_member(uuid) to authenticated, service_role;

create or replace function private.recalculate_circle_member_count(target_circle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.circles
  set member_count = (
    select count(*)::integer
    from public.circle_members
    where circle_id = target_circle_id and status = 'active'
  )
  where id = target_circle_id;
end;
$$;
revoke all on function private.recalculate_circle_member_count(uuid) from public, anon, authenticated;

create or replace function private.refresh_circle_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalculate_circle_member_count(old.circle_id);
    return old;
  end if;

  perform private.recalculate_circle_member_count(new.circle_id);
  return new;
end;
$$;
revoke all on function private.refresh_circle_member_count() from public, anon, authenticated;

drop trigger if exists circle_members_refresh_count on public.circle_members;
create trigger circle_members_refresh_count
after insert or update or delete on public.circle_members
for each row execute procedure private.refresh_circle_member_count();

create or replace function private.recalculate_circle_post_metrics(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.circle_posts
  set
    vote_score = coalesce((select sum(value)::integer from public.circle_post_votes where post_id = target_post_id), 0),
    comments_count = (select count(*)::integer from public.circle_comments where post_id = target_post_id)
  where id = target_post_id;
end;
$$;
revoke all on function private.recalculate_circle_post_metrics(uuid) from public, anon, authenticated;

create or replace function private.refresh_circle_post_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalculate_circle_post_metrics(old.post_id);
    return old;
  end if;

  perform private.recalculate_circle_post_metrics(new.post_id);
  return new;
end;
$$;
revoke all on function private.refresh_circle_post_metrics() from public, anon, authenticated;

drop trigger if exists circle_post_votes_refresh_metrics on public.circle_post_votes;
create trigger circle_post_votes_refresh_metrics
after insert or update or delete on public.circle_post_votes
for each row execute procedure private.refresh_circle_post_metrics();

drop trigger if exists circle_comments_refresh_metrics on public.circle_comments;
create trigger circle_comments_refresh_metrics
after insert or update or delete on public.circle_comments
for each row execute procedure private.refresh_circle_post_metrics();

drop trigger if exists circles_touch_updated_at on public.circles;
create trigger circles_touch_updated_at before update on public.circles
for each row execute procedure public.touch_updated_at();
drop trigger if exists circle_members_touch_updated_at on public.circle_members;
create trigger circle_members_touch_updated_at before update on public.circle_members
for each row execute procedure public.touch_updated_at();
drop trigger if exists circle_posts_touch_updated_at on public.circle_posts;
create trigger circle_posts_touch_updated_at before update on public.circle_posts
for each row execute procedure public.touch_updated_at();
drop trigger if exists circle_post_votes_touch_updated_at on public.circle_post_votes;
create trigger circle_post_votes_touch_updated_at before update on public.circle_post_votes
for each row execute procedure public.touch_updated_at();
drop trigger if exists circle_comments_touch_updated_at on public.circle_comments;
create trigger circle_comments_touch_updated_at before update on public.circle_comments
for each row execute procedure public.touch_updated_at();

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;
alter table public.circle_posts enable row level security;
alter table public.circle_post_votes enable row level security;
alter table public.circle_comments enable row level security;

drop policy if exists "Circle members read circles" on public.circles;
create policy "Circle members read circles" on public.circles
  for select to authenticated
  using ((select private.is_current_circle_member(id)));

drop policy if exists "Circle members read members" on public.circle_members;
create policy "Circle members read members" on public.circle_members
  for select to authenticated
  using ((select private.is_current_circle_member(circle_id)));

drop policy if exists "Circle members read posts" on public.circle_posts;
create policy "Circle members read posts" on public.circle_posts
  for select to authenticated
  using ((select private.is_current_circle_member(circle_id)));

drop policy if exists "Circle members read votes" on public.circle_post_votes;
create policy "Circle members read votes" on public.circle_post_votes
  for select to authenticated
  using (exists (
    select 1 from public.circle_posts
    where public.circle_posts.id = public.circle_post_votes.post_id
      and (select private.is_current_circle_member(public.circle_posts.circle_id))
  ));

drop policy if exists "Circle members read comments" on public.circle_comments;
create policy "Circle members read comments" on public.circle_comments
  for select to authenticated
  using (exists (
    select 1 from public.circle_posts
    where public.circle_posts.id = public.circle_comments.post_id
      and (select private.is_current_circle_member(public.circle_posts.circle_id))
  ));

drop policy if exists "No direct Circle invite access" on public.circle_invites;
create policy "No direct Circle invite access" on public.circle_invites
  for select to authenticated
  using (false);

drop function if exists public.is_current_circle_member(uuid);

revoke all on public.circles, public.circle_members, public.circle_invites, public.circle_posts, public.circle_post_votes, public.circle_comments from anon, authenticated;
grant select on public.circles, public.circle_members, public.circle_posts, public.circle_post_votes, public.circle_comments to authenticated;
grant all on public.circles, public.circle_members, public.circle_invites, public.circle_posts, public.circle_post_votes, public.circle_comments to service_role;
