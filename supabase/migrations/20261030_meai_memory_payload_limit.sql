-- Apply after 20261029_meai_cloud_memory.sql.
-- Add a database-side cap so direct authenticated REST writes cannot store oversized JSON.
alter table public.meai_user_memory
  drop constraint if exists meai_user_memory_payload_size_check;

alter table public.meai_user_memory
  add constraint meai_user_memory_payload_size_check
  check (octet_length(payload::text) <= 140000);
