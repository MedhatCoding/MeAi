-- MeAI persistent workspace schema. All user-owned rows are isolated by RLS.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'محادثة جديدة',
  model text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, mime_type text, storage_path text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  content_text text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text, repository_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null, category text not null default 'general',
  source text, importance smallint not null default 3 check (importance between 1 and 5),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- This compact payload table is the live format currently used by /api/account/memory.
create table if not exists public.meai_user_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"version":1}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists messages_user_created_idx on public.messages(user_id, created_at desc);
create index if not exists workspace_files_user_created_idx on public.workspace_files(user_id, created_at desc);
create index if not exists projects_user_updated_idx on public.projects(user_id, updated_at desc);
create index if not exists memories_user_category_idx on public.memories(user_id, category);
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.workspace_files enable row level security;
alter table public.projects enable row level security;
alter table public.memories enable row level security;
alter table public.meai_user_memory enable row level security;
drop policy if exists "profile owner access" on public.profiles;
create policy "profile owner access" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "conversation owner access" on public.conversations;
create policy "conversation owner access" on public.conversations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "message owner access" on public.messages;
create policy "message owner access" on public.messages for all to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())))
with check ((select auth.uid()) = user_id and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
drop policy if exists "workspace file owner access" on public.workspace_files;
create policy "workspace file owner access" on public.workspace_files for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "project owner access" on public.projects;
create policy "project owner access" on public.projects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "memory owner access" on public.memories;
create policy "memory owner access" on public.memories for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "meai memory owner access" on public.meai_user_memory;
create policy "meai memory owner access" on public.meai_user_memory for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.profiles, public.conversations, public.messages, public.workspace_files, public.projects, public.memories, public.meai_user_memory to authenticated;

revoke all privileges on table public.profiles, public.conversations, public.messages, public.workspace_files, public.projects, public.memories, public.meai_user_memory from anon, public;
