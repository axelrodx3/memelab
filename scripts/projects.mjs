import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.log("MemeLab projects migration skipped: POSTGRES_URL is not available.");
  process.exit(0);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require"
});

await sql.unsafe(`
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id text references public.template_assets(id) on delete set null,
  name text not null default 'Untitled project',
  editor_state jsonb not null default '{"version":1}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 80),
  check (jsonb_typeof(editor_state) = 'object')
);
create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);
create index if not exists projects_template_idx
  on public.projects (template_id);

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute procedure public.touch_updated_at();

alter table public.projects enable row level security;
drop policy if exists "Members read their projects" on public.projects;
create policy "Members read their projects" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Members create their projects" on public.projects;
create policy "Members create their projects" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_active_member());
drop policy if exists "Members update their projects" on public.projects;
create policy "Members update their projects" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_active_member());
drop policy if exists "Members delete their projects" on public.projects;
create policy "Members delete their projects" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members read project assets" on storage.objects;
create policy "Members read project assets" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Members upload project assets" on storage.objects;
create policy "Members upload project assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Members update project assets" on storage.objects;
create policy "Members update project assets" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Members delete project assets" on storage.objects;
create policy "Members delete project assets" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
`);

await sql.end();
console.log("MemeLab private projects are ready.");
