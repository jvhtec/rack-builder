-- Panel layouts: project-scoped connector panel designs.
create table panel_layouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  height_ru integer not null check (height_ru between 1 and 6),
  facing device_facing not null default 'front',
  has_lacing_bar boolean not null default false,
  notes text,
  weight_kg numeric(10,2) not null default 0 check (weight_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index panel_layouts_project_id_idx on panel_layouts(project_id);

-- Per-row density and active-column map (16-column visual system).
create table panel_layout_rows (
  id uuid primary key default gen_random_uuid(),
  panel_layout_id uuid not null references panel_layouts(id) on delete cascade,
  row_index integer not null check (row_index >= 0),
  hole_count integer not null check (hole_count in (4, 6, 8, 12, 16)),
  active_column_map jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index panel_layout_rows_panel_row_idx on panel_layout_rows(panel_layout_id, row_index);
create index panel_layout_rows_panel_layout_id_idx on panel_layout_rows(panel_layout_id);

-- Connector placement instances on a panel.
create table panel_layout_ports (
  id uuid primary key default gen_random_uuid(),
  panel_layout_id uuid not null references panel_layouts(id) on delete cascade,
  connector_id text not null,
  row_index integer not null check (row_index >= 0),
  hole_index integer not null check (hole_index >= 0),
  span_w integer not null default 1 check (span_w > 0),
  span_h integer not null default 1 check (span_h > 0),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index panel_layout_ports_panel_layout_id_idx on panel_layout_ports(panel_layout_id);

-- Layout items now support either a device or a panel layout.
alter table layout_items
add column panel_layout_id uuid references panel_layouts(id) on delete restrict;

alter table layout_items
alter column device_id drop not null;

alter table layout_items
add constraint layout_items_asset_reference_check
check (
  (device_id is not null and panel_layout_id is null)
  or
  (device_id is null and panel_layout_id is not null)
);

create index layout_items_panel_layout_id_idx on layout_items(panel_layout_id);
