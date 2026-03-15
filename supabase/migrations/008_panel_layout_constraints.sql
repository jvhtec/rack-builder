-- Add depth_mm column to panel_layouts
alter table panel_layouts
add column depth_mm integer not null default 80 check (depth_mm > 0);

-- Composite foreign key: panel_layout_ports(panel_layout_id, row_index) → panel_layout_rows
-- Requires a unique constraint on (panel_layout_id, row_index) in panel_layout_rows (already exists via unique index)
alter table panel_layout_rows
add constraint panel_layout_rows_panel_row_unique unique using index panel_layout_rows_panel_row_idx;

alter table panel_layout_ports
add constraint panel_layout_ports_row_fk
foreign key (panel_layout_id, row_index)
references panel_layout_rows(panel_layout_id, row_index)
on delete cascade;

-- Trigger to validate port geometry: bounds check and overlap detection
create or replace function validate_panel_layout_port_geometry()
returns trigger as $$
declare
  target_hole_count integer;
  overlap_count integer;
begin
  -- Look up the target row's hole_count
  select hole_count into target_hole_count
  from panel_layout_rows
  where panel_layout_id = NEW.panel_layout_id and row_index = NEW.row_index;

  if target_hole_count is null then
    raise exception 'Target row does not exist for panel_layout_id=% row_index=%', NEW.panel_layout_id, NEW.row_index;
  end if;

  -- Bounds check: hole_index + span_w must not exceed hole_count
  if NEW.hole_index < 0 or NEW.hole_index + NEW.span_w > target_hole_count then
    raise exception 'Port exceeds row bounds: hole_index=% span_w=% but row has % holes', NEW.hole_index, NEW.span_w, target_hole_count;
  end if;

  -- Overlap detection: check for overlapping spans on same row
  select count(*) into overlap_count
  from panel_layout_ports
  where panel_layout_id = NEW.panel_layout_id
    and row_index = NEW.row_index
    and id is distinct from NEW.id
    and hole_index < NEW.hole_index + NEW.span_w
    and hole_index + span_w > NEW.hole_index;

  if overlap_count > 0 then
    raise exception 'Port overlaps with existing port on row_index=%', NEW.row_index;
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_validate_panel_layout_port_geometry
before insert or update on panel_layout_ports
for each row execute function validate_panel_layout_port_geometry();

-- Row-level security for panel tables
alter table panel_layouts enable row level security;
alter table panel_layout_rows enable row level security;
alter table panel_layout_ports enable row level security;

-- panel_layouts: scoped to user's projects
create policy "panel_layouts_select" on panel_layouts for select using (
  project_id in (select id from projects)
);
create policy "panel_layouts_insert" on panel_layouts for insert with check (
  project_id in (select id from projects)
);
create policy "panel_layouts_update" on panel_layouts for update using (
  project_id in (select id from projects)
);
create policy "panel_layouts_delete" on panel_layouts for delete using (
  project_id in (select id from projects)
);

-- panel_layout_rows: scoped via panel_layout_id → panel_layouts.project_id
create policy "panel_layout_rows_select" on panel_layout_rows for select using (
  panel_layout_id in (select id from panel_layouts)
);
create policy "panel_layout_rows_insert" on panel_layout_rows for insert with check (
  panel_layout_id in (select id from panel_layouts)
);
create policy "panel_layout_rows_update" on panel_layout_rows for update using (
  panel_layout_id in (select id from panel_layouts)
);
create policy "panel_layout_rows_delete" on panel_layout_rows for delete using (
  panel_layout_id in (select id from panel_layouts)
);

-- panel_layout_ports: scoped via panel_layout_id → panel_layouts.project_id
create policy "panel_layout_ports_select" on panel_layout_ports for select using (
  panel_layout_id in (select id from panel_layouts)
);
create policy "panel_layout_ports_insert" on panel_layout_ports for insert with check (
  panel_layout_id in (select id from panel_layouts)
);
create policy "panel_layout_ports_update" on panel_layout_ports for update using (
  panel_layout_id in (select id from panel_layouts)
);
create policy "panel_layout_ports_delete" on panel_layout_ports for delete using (
  panel_layout_id in (select id from panel_layouts)
);

-- Update layout_items policies to allow panel_layout_id items (device_id IS NULL)
-- Drop existing constraint-violating policies if needed, then add permissive ones
-- (These are additive — existing device-based policies remain intact)
create policy "layout_items_panel_insert" on layout_items for insert with check (
  device_id is null and panel_layout_id is not null
  and panel_layout_id in (
    select pl.id from panel_layouts pl
    join layouts l on l.project_id = pl.project_id
    where l.id = layout_id
  )
);
create policy "layout_items_panel_update" on layout_items for update using (
  device_id is null and panel_layout_id is not null
  and panel_layout_id in (
    select pl.id from panel_layouts pl
    join layouts l on l.project_id = pl.project_id
    where l.id = layout_id
  )
);
