-- Kit Factory export storage setup
-- Run this in Supabase SQL Editor if you are not using SUPABASE_SERVICE_ROLE_KEY.
-- It creates the public export bucket and allows the local server, using the anon key,
-- to upload export files and verify public links.

insert into storage.buckets (id, name, public)
values ('kit-exports', 'kit-exports', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Kit Factory public export reads" on storage.objects;
create policy "Kit Factory public export reads"
on storage.objects
for select
to public
using (bucket_id = 'kit-exports');

drop policy if exists "Kit Factory anon export uploads" on storage.objects;
create policy "Kit Factory anon export uploads"
on storage.objects
for insert
to anon
with check (bucket_id = 'kit-exports');

drop policy if exists "Kit Factory anon export upserts" on storage.objects;
create policy "Kit Factory anon export upserts"
on storage.objects
for update
to anon
using (bucket_id = 'kit-exports')
with check (bucket_id = 'kit-exports');

drop policy if exists "Kit Factory healthcheck cleanup" on storage.objects;
create policy "Kit Factory healthcheck cleanup"
on storage.objects
for delete
to anon
using (
  bucket_id = 'kit-exports'
  and (storage.foldername(name))[1] = 'healthcheck'
);
