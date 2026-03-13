-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Backfill one project per existing layout using deterministic ids.
insert into projects (id, name, created_at, updated_at)
select
  l.id,
  l.name,
  coalesce(l.created_at, now()),
  coalesce(l.updated_at, coalesce(l.created_at, now()))
from layouts l;

alter table layouts
add column project_id uuid;

update layouts
set project_id = id
where project_id is null;

alter table layouts
alter column project_id set not null;

alter table layouts
add constraint layouts_project_id_fkey
foreign key (project_id)
references projects(id)
on delete cascade;

create index layouts_project_id_idx on layouts(project_id);

-- Device categories
create table device_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index device_categories_name_lower_idx on device_categories (lower(name));

insert into device_categories (name)
values ('Uncategorized')
on conflict do nothing;

alter table devices
add column category_id uuid;

update devices
set category_id = (
  select id
  from device_categories
  where lower(name) = 'uncategorized'
  limit 1
)
where category_id is null;

alter table devices
alter column category_id set not null;

alter table devices
add constraint devices_category_id_fkey
foreign key (category_id)
references device_categories(id)
on delete restrict;

create index devices_category_id_idx on devices(category_id);
