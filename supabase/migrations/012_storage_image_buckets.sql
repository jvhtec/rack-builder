insert into storage.buckets (id, name, public)
select 'device-images', 'device-images', true
where not exists (
  select 1 from storage.buckets where id = 'device-images'
);

insert into storage.buckets (id, name, public)
select 'connector-images', 'connector-images', true
where not exists (
  select 1 from storage.buckets where id = 'connector-images'
);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_read_image_buckets'
  ) then
    create policy "public_read_image_buckets"
      on storage.objects for select
      using (bucket_id in ('device-images', 'connector-images'));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_insert_image_buckets'
  ) then
    create policy "public_insert_image_buckets"
      on storage.objects for insert
      with check (bucket_id in ('device-images', 'connector-images'));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_update_image_buckets'
  ) then
    create policy "public_update_image_buckets"
      on storage.objects for update
      using (bucket_id in ('device-images', 'connector-images'));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_delete_image_buckets'
  ) then
    create policy "public_delete_image_buckets"
      on storage.objects for delete
      using (bucket_id in ('device-images', 'connector-images'));
  end if;
end
$$;
