-- MeAI per-user cloud memory. Apply this migration in the Supabase SQL Editor.
create table if not exists public.meai_user_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.meai_user_memory enable row level security;

drop policy if exists "Users can read their own MeAI memory" on public.meai_user_memory;
create policy "Users can read their own MeAI memory"
  on public.meai_user_memory for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own MeAI memory" on public.meai_user_memory;
create policy "Users can insert their own MeAI memory"
  on public.meai_user_memory for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own MeAI memory" on public.meai_user_memory;
create policy "Users can update their own MeAI memory"
  on public.meai_user_memory for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.meai_user_memory to authenticated;
