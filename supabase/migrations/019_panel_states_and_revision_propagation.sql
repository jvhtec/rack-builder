alter table panel_layouts
add column drawing_state drawing_state not null default 'preliminary',
add column revision_number integer not null default 0 check (revision_number >= 0);

drop trigger if exists panel_layouts_drawing_revision_trigger on panel_layouts;
create trigger panel_layouts_drawing_revision_trigger
before update on panel_layouts
for each row
execute function set_drawing_revision_on_update();

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
  end if;

  return null;
end;
$$;

drop trigger if exists projects_as_built_propagation_trigger on projects;
create trigger projects_as_built_propagation_trigger
after update on projects
for each row
execute function propagate_project_as_built_to_children();

create or replace function touch_layout_on_layout_item_mutation()
returns trigger
language plpgsql
as $$
declare
  target_layout_id uuid;
begin
  target_layout_id := coalesce(new.layout_id, old.layout_id);
  if target_layout_id is null then
    return null;
  end if;

  update layouts
  set
    revision_number = case when drawing_state = 'rev' then revision_number + 1 else revision_number end,
    updated_at = now()
  where id = target_layout_id;

  return null;
end;
$$;

drop trigger if exists layout_items_touch_layout_insert_trigger on layout_items;
create trigger layout_items_touch_layout_insert_trigger
after insert on layout_items
for each row
execute function touch_layout_on_layout_item_mutation();

drop trigger if exists layout_items_touch_layout_update_trigger on layout_items;
create trigger layout_items_touch_layout_update_trigger
after update on layout_items
for each row
execute function touch_layout_on_layout_item_mutation();

drop trigger if exists layout_items_touch_layout_delete_trigger on layout_items;
create trigger layout_items_touch_layout_delete_trigger
after delete on layout_items
for each row
execute function touch_layout_on_layout_item_mutation();

create or replace function touch_panel_layout_on_children_mutation()
returns trigger
language plpgsql
as $$
declare
  target_panel_layout_id uuid;
begin
  target_panel_layout_id := coalesce(new.panel_layout_id, old.panel_layout_id);
  if target_panel_layout_id is null then
    return null;
  end if;

  update panel_layouts
  set
    revision_number = case when drawing_state = 'rev' then revision_number + 1 else revision_number end,
    updated_at = now()
  where id = target_panel_layout_id;

  return null;
end;
$$;

drop trigger if exists panel_layout_rows_touch_panel_insert_trigger on panel_layout_rows;
create trigger panel_layout_rows_touch_panel_insert_trigger
after insert on panel_layout_rows
for each row
execute function touch_panel_layout_on_children_mutation();

drop trigger if exists panel_layout_rows_touch_panel_update_trigger on panel_layout_rows;
create trigger panel_layout_rows_touch_panel_update_trigger
after update on panel_layout_rows
for each row
execute function touch_panel_layout_on_children_mutation();

drop trigger if exists panel_layout_rows_touch_panel_delete_trigger on panel_layout_rows;
create trigger panel_layout_rows_touch_panel_delete_trigger
after delete on panel_layout_rows
for each row
execute function touch_panel_layout_on_children_mutation();

drop trigger if exists panel_layout_ports_touch_panel_insert_trigger on panel_layout_ports;
create trigger panel_layout_ports_touch_panel_insert_trigger
after insert on panel_layout_ports
for each row
execute function touch_panel_layout_on_children_mutation();

drop trigger if exists panel_layout_ports_touch_panel_update_trigger on panel_layout_ports;
create trigger panel_layout_ports_touch_panel_update_trigger
after update on panel_layout_ports
for each row
execute function touch_panel_layout_on_children_mutation();

drop trigger if exists panel_layout_ports_touch_panel_delete_trigger on panel_layout_ports;
create trigger panel_layout_ports_touch_panel_delete_trigger
after delete on panel_layout_ports
for each row
execute function touch_panel_layout_on_children_mutation();
