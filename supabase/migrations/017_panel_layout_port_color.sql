-- Add optional color column to panel_layout_ports
alter table panel_layout_ports add column color text;

-- Update rpc_save_panel_layout to include color
create or replace function rpc_save_panel_layout(
  p_id uuid,
  p_name text,
  p_facing device_facing,
  p_has_lacing_bar boolean,
  p_notes text,
  p_rows jsonb,
  p_ports jsonb
) returns void as $$
begin
  update panel_layouts set
    name = p_name,
    facing = p_facing,
    has_lacing_bar = p_has_lacing_bar,
    notes = p_notes,
    updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'Panel layout % not found', p_id;
  end if;

  -- Replace rows (deletes cascade to ports via composite FK)
  delete from panel_layout_rows where panel_layout_id = p_id;

  if jsonb_array_length(p_rows) > 0 then
    insert into panel_layout_rows (panel_layout_id, row_index, hole_count, active_column_map)
    select
      p_id,
      (elem->>'row_index')::integer,
      (elem->>'hole_count')::integer,
      elem->'active_column_map'
    from jsonb_array_elements(p_rows) as elem;
  end if;

  -- Insert ports (rows must exist first due to composite FK)
  if jsonb_array_length(p_ports) > 0 then
    insert into panel_layout_ports (panel_layout_id, connector_id, row_index, hole_index, span_w, span_h, label, color)
    select
      p_id,
      elem->>'connector_id',
      (elem->>'row_index')::integer,
      (elem->>'hole_index')::integer,
      (elem->>'span_w')::integer,
      (elem->>'span_h')::integer,
      elem->>'label',
      elem->>'color'
    from jsonb_array_elements(p_ports) as elem;
  end if;
end;
$$ language plpgsql;

-- Update rpc_replace_panel_layout_ports to include color
create or replace function rpc_replace_panel_layout_ports(
  p_panel_layout_id uuid,
  p_ports jsonb
) returns void as $$
begin
  delete from panel_layout_ports where panel_layout_id = p_panel_layout_id;

  if jsonb_array_length(p_ports) > 0 then
    insert into panel_layout_ports (panel_layout_id, connector_id, row_index, hole_index, span_w, span_h, label, color)
    select
      p_panel_layout_id,
      elem->>'connector_id',
      (elem->>'row_index')::integer,
      (elem->>'hole_index')::integer,
      (elem->>'span_w')::integer,
      (elem->>'span_h')::integer,
      elem->>'label',
      elem->>'color'
    from jsonb_array_elements(p_ports) as elem;
  end if;
end;
$$ language plpgsql;

-- Update rpc_duplicate_panel_layout to include color
create or replace function rpc_duplicate_panel_layout(
  p_source_id uuid,
  p_project_id uuid,
  p_new_name text
) returns uuid as $$
declare
  new_id uuid;
  src panel_layouts%rowtype;
begin
  select * into src from panel_layouts where id = p_source_id;
  if not found then
    raise exception 'Source panel layout % not found', p_source_id;
  end if;

  insert into panel_layouts (project_id, name, height_ru, facing, has_lacing_bar, notes, weight_kg, depth_mm)
  values (p_project_id, p_new_name, src.height_ru, src.facing, src.has_lacing_bar, src.notes, src.weight_kg, src.depth_mm)
  returning id into new_id;

  insert into panel_layout_rows (panel_layout_id, row_index, hole_count, active_column_map)
  select new_id, row_index, hole_count, active_column_map
  from panel_layout_rows
  where panel_layout_id = p_source_id;

  insert into panel_layout_ports (panel_layout_id, connector_id, row_index, hole_index, span_w, span_h, label, color)
  select new_id, connector_id, row_index, hole_index, span_w, span_h, label, color
  from panel_layout_ports
  where panel_layout_id = p_source_id;

  return new_id;
end;
$$ language plpgsql;
