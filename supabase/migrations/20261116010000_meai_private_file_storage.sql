-- Private Supabase Storage for MeAI user files.
insert into storage.buckets (id, name, public, file_size_limit)
values ('meai-files', 'meai-files', false, 52428800)
on conflict (id) do update set public=false, file_size_limit=52428800;

drop policy if exists "MeAI users upload own files" on storage.objects;
create policy "MeAI users upload own files" on storage.objects
for insert to authenticated
with check (bucket_id = 'meai-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MeAI users read own files" on storage.objects;
create policy "MeAI users read own files" on storage.objects
for select to authenticated
using (bucket_id = 'meai-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MeAI users delete own files" on storage.objects;
create policy "MeAI users delete own files" on storage.objects
for delete to authenticated
using (bucket_id = 'meai-files' and (storage.foldername(name))[1] = auth.uid()::text);

create index if not exists workspace_files_user_created_idx
on public.workspace_files(user_id, created_at desc);
