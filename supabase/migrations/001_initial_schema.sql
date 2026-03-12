-- Enums
create type rack_width as enum ('single', 'dual');
create type device_facing as enum ('front', 'rear');

-- Racks
create table racks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rack_units integer not null check (rack_units > 0),
  depth_mm integer not null,
  width rack_width not null default 'single',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Devices
create table devices (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  rack_units integer not null check (rack_units > 0),
  depth_mm integer not null,
  front_image_path text,
  rear_image_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Layouts
create table layouts (
  id uuid primary key default gen_random_uuid(),
  rack_id uuid not null references racks(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Layout Items
create table layout_items (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references layouts(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  start_u integer not null,
  facing device_facing not null default 'front',
  notes text
);

-- Storage bucket (run via Supabase dashboard or SQL editor):
-- insert into storage.buckets (id, name, public) values ('device-images', 'device-images', true);
--
-- Storage policy for public read access:
-- create policy "Public read access" on storage.objects for select using (bucket_id = 'device-images');
-- create policy "Allow uploads" on storage.objects for insert with check (bucket_id = 'device-images');
-- create policy "Allow updates" on storage.objects for update using (bucket_id = 'device-images');
-- create policy "Allow deletes" on storage.objects for delete using (bucket_id = 'device-images');
