import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!databaseUrl || !supabaseUrl || !serviceKey) {
  console.log("MemeLab bootstrap skipped: Supabase deployment variables are not available.");
  process.exit(0);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require"
});
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const schema = `
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  bio text not null default '',
  role text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  karma integer not null default 0,
  mature_content_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

create table if not exists public.template_assets (
  id text primary key,
  source text not null,
  source_id text not null,
  name text not null,
  aliases text[] not null default '{}',
  category text not null default 'Trending',
  storage_path text not null unique,
  image_url text not null,
  width integer,
  height integer,
  box_count integer not null default 2,
  rank integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists template_assets_name_lower_idx on public.template_assets (lower(name));
create index if not exists template_assets_rank_idx on public.template_assets (rank);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  source_label text not null default 'MemeLab member',
  title text not null check (char_length(title) between 1 and 140),
  caption text not null default '' check (char_length(caption) <= 2000),
  image_url text not null,
  storage_path text,
  source_template_id text references public.template_assets(id) on delete set null,
  is_mature boolean not null default false,
  status text not null default 'active' check (status in ('active', 'flagged', 'removed')),
  vote_score integer not null default 0,
  upvotes_count integer not null default 0,
  downvotes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists posts_seed_template_idx
  on public.posts (source_template_id) where author_id is null and source_template_id is not null;
create index if not exists posts_hot_idx on public.posts (status, vote_score desc, created_at desc);
create index if not exists posts_new_idx on public.posts (status, created_at desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);

create table if not exists public.post_votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'active' check (status in ('active', 'flagged', 'removed')),
  score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (reason in ('illegal', 'spam', 'harassment', 'mature_unmarked', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((post_id is not null)::integer + (comment_id is not null)::integer = 1)
);
create index if not exists reports_status_idx on public.reports (status, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  type text not null check (type in ('comment', 'reply', 'mention', 'milestone', 'moderation')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  comment_id uuid references public.comments(id) on delete set null,
  action text not null check (action in ('flag', 'remove', 'restore', 'warn', 'suspend', 'ban')),
  reason text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  base_name text;
begin
  base_name := regexp_replace(
    lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, 'member'), '@', 1))),
    '[^a-z0-9_]+',
    '',
    'g'
  );
  if char_length(base_name) < 3 then
    base_name := 'member';
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    left(base_name, 20) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'MemeLab member'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute procedure public.touch_updated_at();
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at before update on public.posts
for each row execute procedure public.touch_updated_at();
drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at before update on public.comments
for each row execute procedure public.touch_updated_at();
drop trigger if exists post_votes_touch_updated_at on public.post_votes;
create trigger post_votes_touch_updated_at before update on public.post_votes
for each row execute procedure public.touch_updated_at();
drop trigger if exists comment_votes_touch_updated_at on public.comment_votes;
create trigger comment_votes_touch_updated_at before update on public.comment_votes
for each row execute procedure public.touch_updated_at();

create or replace function public.refresh_post_vote_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  target_id := coalesce(new.post_id, old.post_id);
  update public.posts
  set
    upvotes_count = (select count(*) from public.post_votes where post_id = target_id and value = 1),
    downvotes_count = (select count(*) from public.post_votes where post_id = target_id and value = -1),
    vote_score = (select coalesce(sum(value), 0) from public.post_votes where post_id = target_id)
  where id = target_id;
  return coalesce(new, old);
end;
$$;
drop trigger if exists post_votes_refresh_counts on public.post_votes;
create trigger post_votes_refresh_counts
after insert or update or delete on public.post_votes
for each row execute procedure public.refresh_post_vote_counts();

create or replace function public.refresh_comment_vote_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  target_id := coalesce(new.comment_id, old.comment_id);
  update public.comments
  set score = (select coalesce(sum(value), 0) from public.comment_votes where comment_id = target_id)
  where id = target_id;
  return coalesce(new, old);
end;
$$;
drop trigger if exists comment_votes_refresh_counts on public.comment_votes;
create trigger comment_votes_refresh_counts
after insert or update or delete on public.comment_votes
for each row execute procedure public.refresh_comment_vote_counts();

create or replace function public.refresh_post_comment_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  target_id := coalesce(new.post_id, old.post_id);
  update public.posts
  set comments_count = (
    select count(*) from public.comments where post_id = target_id and status != 'removed'
  )
  where id = target_id;
  return coalesce(new, old);
end;
$$;
drop trigger if exists comments_refresh_post_count on public.comments;
create trigger comments_refresh_post_count
after insert or update or delete on public.comments
for each row execute procedure public.refresh_post_comment_count();

create or replace function public.enforce_post_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (
    select count(*) from public.posts
    where author_id = new.author_id and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Posting limit reached. Please wait a few minutes.';
  end if;
  return new;
end;
$$;
drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
for each row when (new.author_id is not null) execute procedure public.enforce_post_rate_limit();

create or replace function public.enforce_comment_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (
    select count(*) from public.comments
    where author_id = new.author_id and created_at > now() - interval '10 minutes'
  ) >= 25 then
    raise exception 'Commenting limit reached. Please wait a few minutes.';
  end if;
  return new;
end;
$$;
drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit before insert on public.comments
for each row when (new.author_id is not null) execute procedure public.enforce_comment_rate_limit();

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('moderator', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.template_assets enable row level security;
alter table public.posts enable row level security;
alter table public.post_votes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_votes enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.moderation_actions enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select using (true);
drop policy if exists "Members update their profile" on public.profiles;
create policy "Members update their profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Templates are public" on public.template_assets;
create policy "Templates are public" on public.template_assets for select using (true);

drop policy if exists "Active posts are public" on public.posts;
create policy "Active posts are public" on public.posts for select using (status = 'active' or public.is_moderator());
drop policy if exists "Members create posts" on public.posts;
create policy "Members create posts" on public.posts for insert to authenticated
with check ((select auth.uid()) = author_id);
drop policy if exists "Members update their posts" on public.posts;
create policy "Members update their posts" on public.posts for update to authenticated
using ((select auth.uid()) = author_id or public.is_moderator())
with check ((select auth.uid()) = author_id or public.is_moderator());
drop policy if exists "Members delete their posts" on public.posts;
create policy "Members delete their posts" on public.posts for delete to authenticated
using ((select auth.uid()) = author_id or public.is_moderator());

drop policy if exists "Members read their votes" on public.post_votes;
create policy "Members read their votes" on public.post_votes for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Members create votes" on public.post_votes;
create policy "Members create votes" on public.post_votes for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Members update votes" on public.post_votes;
create policy "Members update votes" on public.post_votes for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Members delete votes" on public.post_votes;
create policy "Members delete votes" on public.post_votes for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Active comments are public" on public.comments;
create policy "Active comments are public" on public.comments for select
using (status = 'active' or public.is_moderator());
drop policy if exists "Members create comments" on public.comments;
create policy "Members create comments" on public.comments for insert to authenticated
with check ((select auth.uid()) = author_id);
drop policy if exists "Members update comments" on public.comments;
create policy "Members update comments" on public.comments for update to authenticated
using ((select auth.uid()) = author_id or public.is_moderator())
with check ((select auth.uid()) = author_id or public.is_moderator());
drop policy if exists "Members delete comments" on public.comments;
create policy "Members delete comments" on public.comments for delete to authenticated
using ((select auth.uid()) = author_id or public.is_moderator());

drop policy if exists "Members read their comment votes" on public.comment_votes;
create policy "Members read their comment votes" on public.comment_votes for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Members create comment votes" on public.comment_votes;
create policy "Members create comment votes" on public.comment_votes for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Members update comment votes" on public.comment_votes;
create policy "Members update comment votes" on public.comment_votes for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Members delete comment votes" on public.comment_votes;
create policy "Members delete comment votes" on public.comment_votes for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members submit reports" on public.reports;
create policy "Members submit reports" on public.reports for insert to authenticated
with check ((select auth.uid()) = reporter_id);
drop policy if exists "Moderators review reports" on public.reports;
create policy "Moderators review reports" on public.reports for all to authenticated
using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists "Members read notifications" on public.notifications;
create policy "Members read notifications" on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Members update notifications" on public.notifications;
create policy "Members update notifications" on public.notifications for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Moderators read actions" on public.moderation_actions;
create policy "Moderators read actions" on public.moderation_actions for select to authenticated
using (public.is_moderator());
drop policy if exists "Moderators create actions" on public.moderation_actions;
create policy "Moderators create actions" on public.moderation_actions for insert to authenticated
with check (public.is_moderator() and (select auth.uid()) = moderator_id);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles, public.template_assets, public.posts, public.comments to anon, authenticated;
grant insert, update, delete on public.profiles, public.posts, public.post_votes,
  public.comments, public.comment_votes, public.reports, public.notifications to authenticated;
grant select on public.post_votes, public.comment_votes, public.reports,
  public.notifications, public.moderation_actions to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.is_moderator() to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('templates', 'templates', true, 26214400, array['image/jpeg', 'image/png', 'image/webp']),
  ('community', 'community', true, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload community images" on storage.objects;
create policy "Members upload community images" on storage.objects for insert to authenticated
with check (
  bucket_id = 'community'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Members update community images" on storage.objects;
create policy "Members update community images" on storage.objects for update to authenticated
using (
  bucket_id = 'community'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'community'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Members delete community images" on storage.objects;
create policy "Members delete community images" on storage.objects for delete to authenticated
using (
  bucket_id = 'community'
  and owner_id = (select auth.uid())::text
);
`;

const CLASSICS = [
  "drake", "distracted boyfriend", "two buttons", "change my mind",
  "expanding brain", "success kid", "one does not simply", "disaster girl",
  "ancient aliens", "doge", "this is fine", "always has been"
];

function categorize(name, aliases = []) {
  const value = `${name} ${aliases.join(" ")}`.toLowerCase();
  if (/(doge|cat|dog|monkey|bear|bird|animal|seal|rabbit)/.test(value)) return "Animals";
  if (/(movie|star wars|batman|spider|avengers|matrix|lord of the rings|gru|simpsons|futurama|jurassic|marvel|disney|pixar)/.test(value)) return "Movies";
  if (/(drake|reaction|surprised|laugh|cry|sad|angry|face|side eye|fine)/.test(value)) return "Reaction";
  if (CLASSICS.some((classic) => value.includes(classic))) return "Classic";
  return "Trending";
}

function extensionFromPath(pathname) {
  const match = pathname.match(/\.(jpg|jpeg|png|webp)$/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

function contentType(extension) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

async function fetchCatalog() {
  const [imgflipResponse, memegenResponse] = await Promise.all([
    fetch("https://api.imgflip.com/get_memes?type=image", { signal: AbortSignal.timeout(30000) }),
    fetch("https://api.memegen.link/templates/", { signal: AbortSignal.timeout(30000) })
  ]);
  if (!imgflipResponse.ok || !memegenResponse.ok) {
    throw new Error("A template seed source was unavailable.");
  }

  const imgflipPayload = await imgflipResponse.json();
  const memegenPayload = await memegenResponse.json();
  const templates = [];
  const byName = new Map();

  for (const meme of imgflipPayload.data?.memes || []) {
    const sourceUrl = meme.url;
    const sourceId = String(meme.id);
    const extension = extensionFromPath(new URL(sourceUrl).pathname);
    const template = {
      id: sourceId,
      source: "imgflip",
      sourceId,
      name: meme.name,
      aliases: [],
      category: categorize(meme.name),
      sourceUrl,
      extension,
      width: meme.width || null,
      height: meme.height || null,
      boxCount: meme.box_count || 2
    };
    byName.set(meme.name.toLowerCase().replace(/[^a-z0-9]+/g, ""), template);
    templates.push(template);
  }

  for (const meme of Array.isArray(memegenPayload) ? memegenPayload : []) {
    const sourceId = String(meme.id || "").trim();
    const name = String(meme.name || "").trim();
    if (!sourceId || !name || typeof meme.blank !== "string") continue;
    const aliases = Array.isArray(meme.keywords)
      ? meme.keywords.filter((keyword) => typeof keyword === "string")
      : [];
    const nameKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const existing = byName.get(nameKey);
    if (existing) {
      existing.aliases = [...new Set([...existing.aliases, ...aliases])];
      continue;
    }

    const extension = extensionFromPath(new URL(meme.blank).pathname);
    const template = {
      id: `mg_${sourceId}`,
      source: "memegen",
      sourceId,
      name,
      aliases,
      category: categorize(name, aliases),
      sourceUrl: meme.blank,
      extension,
      width: null,
      height: null,
      boxCount: Number(meme.lines) || 2
    };
    byName.set(nameKey, template);
    templates.push(template);
  }

  return templates.map((template, index) => ({ ...template, rank: index + 1 }));
}

async function mapWithConcurrency(items, limit, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function syncTemplates() {
  const [{ count }] = await sql`
    select count(*)::integer as count from public.template_assets
  `;
  if (count >= 200) {
    console.log(`MemeLab template storage already contains ${count} assets; import skipped.`);
    return;
  }

  const catalog = await fetchCatalog();
  let imported = 0;
  let failed = 0;

  await mapWithConcurrency(catalog, 8, async (template) => {
    try {
      const response = await fetch(template.sourceUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const storagePath = `${template.source}/${template.sourceId}.${template.extension}`;
      const { error: uploadError } = await supabase.storage
        .from("templates")
        .upload(storagePath, bytes, {
          contentType: contentType(template.extension),
          cacheControl: "31536000",
          upsert: true
        });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from("templates").getPublicUrl(storagePath);
      await sql`
        insert into public.template_assets (
          id, source, source_id, name, aliases, category, storage_path,
          image_url, width, height, box_count, rank
        )
        values (
          ${template.id}, ${template.source}, ${template.sourceId}, ${template.name},
          ${template.aliases}, ${template.category}, ${storagePath},
          ${publicUrl.publicUrl}, ${template.width}, ${template.height},
          ${template.boxCount}, ${template.rank}
        )
        on conflict (id) do update set
          name = excluded.name,
          aliases = excluded.aliases,
          category = excluded.category,
          storage_path = excluded.storage_path,
          image_url = excluded.image_url,
          width = excluded.width,
          height = excluded.height,
          box_count = excluded.box_count,
          rank = excluded.rank
      `;
      imported += 1;
    } catch (error) {
      failed += 1;
      console.warn(`Template import failed for ${template.id}: ${error.message}`);
    }
  });

  console.log(`MemeLab template import complete: ${imported} stored, ${failed} skipped.`);
}

async function seedCommunity() {
  const templates = await sql`
    select id, name, image_url from public.template_assets
    order by rank asc
    limit 6
  `;
  for (const template of templates) {
    await sql`
      insert into public.posts (
        author_id, source_label, title, caption, image_url, source_template_id
      )
      values (
        null, 'MemeLab', ${template.name}, 'A classic format ready for its next remix.',
        ${template.image_url}, ${template.id}
      )
      on conflict (source_template_id) where author_id is null and source_template_id is not null
      do nothing
    `;
  }
}

try {
  console.log("Preparing MemeLab community database and storage…");
  await sql.unsafe(schema);
  await syncTemplates();
  await seedCommunity();
  console.log("MemeLab community bootstrap complete.");
} finally {
  await sql.end();
}
