create or replace function rpc_create_panel_layout(
  p_project_id uuid,
  p_name text,
  p_drawing_state drawing_state,
  p_height_ru integer,
  p_facing device_facing,
  p_has_lacing_bar boolean,
  p_notes text,
  p_weight_kg numeric,
  p_default_hole_count integer
) returns uuid as $$
declare
  new_id uuid;
begin
  insert into panel_layouts (project_id, name, drawing_state, height_ru, facing, has_lacing_bar, notes, weight_kg)
  values (p_project_id, p_name, p_drawing_state, p_height_ru, p_facing, p_has_lacing_bar, p_notes, p_weight_kg)
  returning id into new_id;

  insert into panel_layout_rows (panel_layout_id, row_index, hole_count, active_column_map)
  select
    new_id,
    gs.idx,
    p_default_hole_count,
    '[]'::jsonb
  from generate_series(0, p_height_ru - 1) as gs(idx);

  return new_id;
end;
$$ language plpgsql;

create or replace function rpc_save_panel_layout(
  p_id uuid,
  p_name text,
  p_drawing_state drawing_state,
  p_facing device_facing,
  p_has_lacing_bar boolean,
  p_notes text,
  p_rows jsonb,
  p_ports jsonb
) returns void as $$
begin
  update panel_layouts set
    name = p_name,
    drawing_state = p_drawing_state,
    facing = p_facing,
    has_lacing_bar = p_has_lacing_bar,
    notes = p_notes,
    updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'Panel layout % not found', p_id;
  end if;

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

  insert into panel_layouts (project_id, name, drawing_state, height_ru, facing, has_lacing_bar, notes, weight_kg, depth_mm)
  values (p_project_id, p_new_name, src.drawing_state, src.height_ru, src.facing, src.has_lacing_bar, src.notes, src.weight_kg, src.depth_mm)
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

create or replace function propagate_project_as_built_to_children()
returns trigger
language plpgsql
as $$
begin
  if new.drawing_state = 'as_built' and old.drawing_state is distinct from new.drawing_state then
    update layouts
    set drawing_state = 'as_built', updated_at = now()
    where project_id = new.id and drawing_state <> 'as_built';

    update panel_layouts
    set drawing_state = 'as_built', updated_at = now()
    where project_id = new.id and drawing_state <> 'as_built';
  elsif old.drawing_state = 'as_built' and new.drawing_state is distinct from old.drawing_state then
    update layouts
    set drawing_state = new.drawing_state, updated_at = now()
    where project_id = new.id and drawing_state = 'as_built';

    update panel_layouts
    set drawing_state = new.drawing_state, updated_at = now()
    where project_id = new.id and drawing_state = 'as_built';
  end if;

  return null;
end;
$$;

create or replace function touch_panel_layouts_from_new_rows()
returns trigger
language plpgsql
as $$
begin
  update panel_layouts p
  set
    revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
    updated_at = now()
  where p.id in (select distinct panel_layout_id from new_rows);

  return null;
end;
$$;

create or replace function touch_panel_layouts_from_old_rows()
returns trigger
language plpgsql
as $$
begin
  update panel_layouts p
  set
    revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
    updated_at = now()
  where p.id in (select distinct panel_layout_id from old_rows);

  return null;
end;
$$;

create or replace function touch_panel_layouts_from_old_and_new_rows()
returns trigger
language plpgsql
as $$
begin
  update panel_layouts p
  set
    revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
    updated_at = now()
  where p.id in (
    select distinct panel_layout_id from new_rows
    union
    select distinct panel_layout_id from old_rows
  );

  return null;
end;
$$;

create or replace function touch_panel_layouts_from_new_ports()
returns trigger
language plpgsql
as $$
begin
  update panel_layouts p
  set
    revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
    updated_at = now()
  where p.id in (select distinct panel_layout_id from new_ports);

  return null;
end;
$$;

create or replace function touch_panel_layouts_from_old_ports()
returns trigger
language plpgsql
as $$
begin
  update panel_layouts p
  set
    revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
    updated_at = now()
  where p.id in (select distinct panel_layout_id from old_ports);

  return null;
end;
$$;

create or replace function touch_panel_layouts_from_old_and_new_ports()
returns trigger
language plpgsql
as $$
begin
  update panel_layouts p
  set
    revision_number = case when p.drawing_state = 'rev' then p.revision_number + 1 else p.revision_number end,
    updated_at = now()
  where p.id in (
    select distinct panel_layout_id from new_ports
    union
    select distinct panel_layout_id from old_ports
  );

  return null;
end;
$$;

drop trigger if exists panel_layout_rows_touch_panel_insert_trigger on panel_layout_rows;
drop trigger if exists panel_layout_rows_touch_panel_update_trigger on panel_layout_rows;
drop trigger if exists panel_layout_rows_touch_panel_delete_trigger on panel_layout_rows;

create trigger panel_layout_rows_touch_panel_insert_trigger
after insert on panel_layout_rows
referencing new table as new_rows
for each statement
execute function touch_panel_layouts_from_new_rows();

create trigger panel_layout_rows_touch_panel_update_trigger
after update on panel_layout_rows
referencing old table as old_rows new table as new_rows
for each statement
execute function touch_panel_layouts_from_old_and_new_rows();

create trigger panel_layout_rows_touch_panel_delete_trigger
after delete on panel_layout_rows
referencing old table as old_rows
for each statement
execute function touch_panel_layouts_from_old_rows();

drop trigger if exists panel_layout_ports_touch_panel_insert_trigger on panel_layout_ports;
drop trigger if exists panel_layout_ports_touch_panel_update_trigger on panel_layout_ports;
drop trigger if exists panel_layout_ports_touch_panel_delete_trigger on panel_layout_ports;

create trigger panel_layout_ports_touch_panel_insert_trigger
after insert on panel_layout_ports
referencing new table as new_ports
for each statement
execute function touch_panel_layouts_from_new_ports();

create trigger panel_layout_ports_touch_panel_update_trigger
after update on panel_layout_ports
referencing old table as old_ports new table as new_ports
for each statement
execute function touch_panel_layouts_from_old_and_new_ports();

create trigger panel_layout_ports_touch_panel_delete_trigger
after delete on panel_layout_ports
referencing old table as old_ports
for each statement
execute function touch_panel_layouts_from_old_ports();
