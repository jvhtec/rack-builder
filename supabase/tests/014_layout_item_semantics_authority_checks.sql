-- Manual SQL verification for migration 014_layout_item_semantics_authority.sql
-- Run in a transaction so nothing persists.

begin;

do $$
declare
  v_project_id uuid := gen_random_uuid();
  v_single_rack_id uuid := gen_random_uuid();
  v_dual_rack_id uuid := gen_random_uuid();
  v_layout_single_id uuid := gen_random_uuid();
  v_layout_dual_id uuid := gen_random_uuid();
  v_device_safe_front uuid := gen_random_uuid();
  v_device_safe_rear uuid := gen_random_uuid();
  v_device_deep uuid := gen_random_uuid();
  v_device_short uuid := gen_random_uuid();
  v_device_tall uuid := gen_random_uuid();
begin
  insert into projects (id, name) values (v_project_id, 'RB semantics test');

  insert into racks (id, name, rack_units, depth_mm, width)
  values
    (v_single_rack_id, 'RB Single', 10, 800, 'single'),
    (v_dual_rack_id, 'RB Dual', 10, 800, 'dual');

  insert into layouts (id, project_id, rack_id, name)
  values
    (v_layout_single_id, v_project_id, v_single_rack_id, 'Single layout'),
    (v_layout_dual_id, v_project_id, v_dual_rack_id, 'Dual layout');

  insert into devices (id, brand, model, rack_units, depth_mm, is_half_rack, category_id)
  values
    (v_device_safe_front, 'RB', 'SafeFront', 2, 300, false, (select id from device_categories limit 1)),
    (v_device_safe_rear, 'RB', 'SafeRear', 2, 400, false, (select id from device_categories limit 1)),
    (v_device_deep, 'RB', 'TooDeep', 2, 600, false, (select id from device_categories limit 1)),
    (v_device_short, 'RB', 'Short', 1, 300, false, (select id from device_categories limit 1)),
    (v_device_tall, 'RB', 'Tall', 3, 300, false, (select id from device_categories limit 1));

  -- Scenario 1: Front+rear same U with safe depth must be allowed.
  insert into layout_items (layout_id, device_id, start_u, facing)
  values (v_layout_single_id, v_device_safe_front, 3, 'front');
  insert into layout_items (layout_id, device_id, start_u, facing)
  values (v_layout_single_id, v_device_safe_rear, 3, 'rear');

  -- Scenario 2: Front+rear same U with excessive depth must fail with RB_DEPTH.
  begin
    insert into layout_items (layout_id, device_id, start_u, facing)
    values (v_layout_single_id, v_device_deep, 3, 'rear');
    raise exception 'Expected RB_DEPTH but insert succeeded';
  exception
    when others then
      if sqlerrm not like 'RB_DEPTH:%' then
        raise;
      end if;
  end;

  -- Scenario 3: Same-face same-footprint overlap must fail with RB_SLOT.
  begin
    insert into layout_items (layout_id, device_id, start_u, facing)
    values (v_layout_single_id, v_device_short, 4, 'front');
    raise exception 'Expected RB_SLOT but insert succeeded';
  exception
    when others then
      if sqlerrm not like 'RB_SLOT:%' then
        raise;
      end if;
  end;

  -- Scenario 4: Same-face different bay in dual rack must be allowed.
  insert into layout_items (layout_id, device_id, start_u, facing, preferred_lane)
  values (v_layout_dual_id, v_device_short, 2, 'front', 0);
  insert into layout_items (layout_id, device_id, start_u, facing, preferred_lane)
  values (v_layout_dual_id, v_device_short, 2, 'front', 1);

  -- Scenario 5: Out-of-bounds placement must fail with RB_BOUNDS.
  begin
    insert into layout_items (layout_id, device_id, start_u, facing)
    values (v_layout_single_id, v_device_tall, 9, 'front');
    raise exception 'Expected RB_BOUNDS but insert succeeded';
  exception
    when others then
      if sqlerrm not like 'RB_BOUNDS:%' then
        raise;
      end if;
  end;
end
$$;

rollback;
