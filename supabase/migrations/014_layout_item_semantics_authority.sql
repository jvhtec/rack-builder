-- Backend-authoritative rack placement semantics.
-- Enforces bounds, same-face slot overlap, and cross-face depth collisions.

create or replace function rb_layout_item_traits(
  p_device_id uuid,
  p_panel_layout_id uuid
)
returns table (
  height_ru integer,
  depth_mm integer,
  is_half_rack boolean
)
language plpgsql
as $$
begin
  if p_device_id is not null then
    return query
    select d.rack_units, d.depth_mm, d.is_half_rack
    from devices d
    where d.id = p_device_id;

    if found then
      return;
    end if;

    raise exception 'RB_SLOT: device % not found', p_device_id;
  end if;

  if p_panel_layout_id is not null then
    return query
    select p.height_ru, p.depth_mm, false
    from panel_layouts p
    where p.id = p_panel_layout_id;

    if found then
      return;
    end if;

    raise exception 'RB_SLOT: panel_layout % not found', p_panel_layout_id;
  end if;

  raise exception 'RB_SLOT: layout item must reference a device or panel layout';
end;
$$;

create or replace function rb_layout_item_slot(
  p_rack_width rack_width,
  p_preferred_lane integer,
  p_preferred_sub_lane integer,
  p_is_half_rack boolean,
  p_force_full_width boolean
)
returns table (
  outer_lane integer,
  inner_lane integer
)
language plpgsql
as $$
declare
  lane integer;
begin
  if p_rack_width = 'single' then
    if not p_is_half_rack or p_force_full_width then
      return query select null::integer, null::integer;
      return;
    end if;

    lane := case when p_preferred_lane = 1 then 1 else 0 end;
    return query select lane, null::integer;
    return;
  end if;

  lane := case when p_preferred_lane = 1 then 1 else 0 end;
  if not p_is_half_rack or p_force_full_width then
    return query select lane, null::integer;
    return;
  end if;

  return query
  select lane, case when p_preferred_sub_lane = 1 then 1 else 0 end;
end;
$$;

create or replace function rb_u_ranges_overlap(
  p_start_a integer,
  p_height_a integer,
  p_start_b integer,
  p_height_b integer
)
returns boolean
language sql
immutable
as $$
  select
    p_start_a <= (p_start_b + p_height_b - 1)
    and (p_start_a + p_height_a - 1) >= p_start_b
$$;

create or replace function rb_slots_conflict(
  p_outer_a integer,
  p_inner_a integer,
  p_outer_b integer,
  p_inner_b integer
)
returns boolean
language sql
immutable
as $$
  select
    case
      when p_outer_a is null or p_outer_b is null then true
      when p_outer_a <> p_outer_b then false
      when p_inner_a is null or p_inner_b is null then true
      else p_inner_a = p_inner_b
    end
$$;

create or replace function rb_validate_layout_item_semantics()
returns trigger
language plpgsql
as $$
declare
  v_rack record;
  v_new_traits record;
  v_new_slot record;
  v_other record;
  v_other_traits record;
  v_other_slot record;
begin
  select r.id, r.rack_units, r.depth_mm, r.width
  into v_rack
  from layouts l
  join racks r on r.id = l.rack_id
  where l.id = new.layout_id;

  if not found then
    raise exception 'RB_BOUNDS: layout % has no rack', new.layout_id;
  end if;

  select *
  into v_new_traits
  from rb_layout_item_traits(new.device_id, new.panel_layout_id);

  if new.start_u < 1 or new.start_u + v_new_traits.height_ru - 1 > v_rack.rack_units then
    raise exception
      'RB_BOUNDS: item % at U% with %U exceeds rack bounds 1..%U',
      coalesce(new.id::text, '<new>'),
      new.start_u,
      v_new_traits.height_ru,
      v_rack.rack_units;
  end if;

  select *
  into v_new_slot
  from rb_layout_item_slot(
    v_rack.width,
    new.preferred_lane,
    new.preferred_sub_lane,
    v_new_traits.is_half_rack,
    new.force_full_width
  );

  for v_other in
    select *
    from layout_items
    where layout_id = new.layout_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    select *
    into v_other_traits
    from rb_layout_item_traits(v_other.device_id, v_other.panel_layout_id);

    if not rb_u_ranges_overlap(new.start_u, v_new_traits.height_ru, v_other.start_u, v_other_traits.height_ru) then
      continue;
    end if;

    select *
    into v_other_slot
    from rb_layout_item_slot(
      v_rack.width,
      v_other.preferred_lane,
      v_other.preferred_sub_lane,
      v_other_traits.is_half_rack,
      v_other.force_full_width
    );

    if not rb_slots_conflict(
      v_new_slot.outer_lane,
      v_new_slot.inner_lane,
      v_other_slot.outer_lane,
      v_other_slot.inner_lane
    ) then
      continue;
    end if;

    if v_other.facing = new.facing then
      raise exception
        'RB_SLOT: item % overlaps item % on facing %',
        coalesce(new.id::text, '<new>'),
        v_other.id,
        new.facing;
    end if;

    if v_new_traits.depth_mm + v_other_traits.depth_mm > v_rack.depth_mm then
      raise exception
        'RB_DEPTH: item % (%mm) collides with item % (%mm) in rack depth %mm',
        coalesce(new.id::text, '<new>'),
        v_new_traits.depth_mm,
        v_other.id,
        v_other_traits.depth_mm,
        v_rack.depth_mm;
    end if;
  end loop;

  return new;
end;
$$;

create or replace function rb_backfill_layout_item_slots()
returns void
language plpgsql
as $$
declare
  v_group record;
  v_item record;
  v_eff_half boolean;
  v_found boolean;
  v_outer integer;
  v_inner integer;
  v_pref_outer integer[];
  v_pref_inner integer[];
  v_candidate_outer integer;
  v_candidate_inner integer;
begin
  create temporary table if not exists tmp_rb_assigned (
    item_id uuid primary key,
    start_u integer not null,
    height_ru integer not null,
    outer_lane integer null,
    inner_lane integer null
  ) on commit drop;

  for v_group in
    select
      l.id as layout_id,
      r.width as rack_width,
      side.facing
    from layouts l
    join racks r on r.id = l.rack_id
    cross join (values ('front'::device_facing), ('rear'::device_facing)) as side(facing)
  loop
    truncate table tmp_rb_assigned;

    for v_item in
      select
        li.id,
        li.start_u,
        li.preferred_lane,
        li.preferred_sub_lane,
        li.force_full_width,
        t.height_ru,
        t.is_half_rack
      from layout_items li
      cross join lateral rb_layout_item_traits(li.device_id, li.panel_layout_id) t
      where li.layout_id = v_group.layout_id
        and li.facing = v_group.facing
      order by li.start_u, li.id
    loop
      v_eff_half := v_item.is_half_rack and not v_item.force_full_width;
      v_found := false;
      v_outer := null;
      v_inner := null;
      v_pref_outer := case when v_item.preferred_lane = 1 then array[1, 0] else array[0, 1] end;
      v_pref_inner := case when v_item.preferred_sub_lane = 1 then array[1, 0] else array[0, 1] end;

      if v_group.rack_width = 'single' then
        if v_eff_half then
          foreach v_candidate_outer in array v_pref_outer loop
            if not exists (
              select 1
              from tmp_rb_assigned a
              where rb_u_ranges_overlap(v_item.start_u, v_item.height_ru, a.start_u, a.height_ru)
                and rb_slots_conflict(v_candidate_outer, null, a.outer_lane, a.inner_lane)
            ) then
              v_outer := v_candidate_outer;
              v_inner := null;
              v_found := true;
              exit;
            end if;
          end loop;
        else
          if not exists (
            select 1
            from tmp_rb_assigned a
            where rb_u_ranges_overlap(v_item.start_u, v_item.height_ru, a.start_u, a.height_ru)
              and rb_slots_conflict(null, null, a.outer_lane, a.inner_lane)
          ) then
            v_outer := null;
            v_inner := null;
            v_found := true;
          end if;
        end if;
      else
        if v_eff_half then
          foreach v_candidate_outer in array v_pref_outer loop
            foreach v_candidate_inner in array v_pref_inner loop
              if not exists (
                select 1
                from tmp_rb_assigned a
                where rb_u_ranges_overlap(v_item.start_u, v_item.height_ru, a.start_u, a.height_ru)
                  and rb_slots_conflict(v_candidate_outer, v_candidate_inner, a.outer_lane, a.inner_lane)
              ) then
                v_outer := v_candidate_outer;
                v_inner := v_candidate_inner;
                v_found := true;
                exit;
              end if;
            end loop;
            if v_found then
              exit;
            end if;
          end loop;
        else
          foreach v_candidate_outer in array v_pref_outer loop
            if not exists (
              select 1
              from tmp_rb_assigned a
              where rb_u_ranges_overlap(v_item.start_u, v_item.height_ru, a.start_u, a.height_ru)
                and rb_slots_conflict(v_candidate_outer, null, a.outer_lane, a.inner_lane)
            ) then
              v_outer := v_candidate_outer;
              v_inner := null;
              v_found := true;
              exit;
            end if;
          end loop;
        end if;
      end if;

      if not v_found then
        select s.outer_lane, s.inner_lane
        into v_outer, v_inner
        from rb_layout_item_slot(
          v_group.rack_width,
          v_item.preferred_lane,
          v_item.preferred_sub_lane,
          v_item.is_half_rack,
          v_item.force_full_width
        ) s;
      end if;

      if v_group.rack_width = 'single' then
        if v_eff_half then
          update layout_items
          set preferred_lane = v_outer, preferred_sub_lane = null
          where id = v_item.id;
        else
          update layout_items
          set preferred_sub_lane = null
          where id = v_item.id;
        end if;
      else
        if v_eff_half then
          update layout_items
          set preferred_lane = coalesce(v_outer, 0), preferred_sub_lane = coalesce(v_inner, 0)
          where id = v_item.id;
        else
          update layout_items
          set preferred_lane = coalesce(v_outer, 0), preferred_sub_lane = null
          where id = v_item.id;
        end if;
      end if;

      insert into tmp_rb_assigned (item_id, start_u, height_ru, outer_lane, inner_lane)
      values (v_item.id, v_item.start_u, v_item.height_ru, v_outer, v_inner);
    end loop;
  end loop;
end;
$$;

select rb_backfill_layout_item_slots();

do $$
declare
  v_violation record;
begin
  select
    li.id as item_id,
    li.layout_id,
    li.start_u,
    t.height_ru,
    r.rack_units
  into v_violation
  from layout_items li
  join layouts l on l.id = li.layout_id
  join racks r on r.id = l.rack_id
  cross join lateral rb_layout_item_traits(li.device_id, li.panel_layout_id) t
  where li.start_u < 1
    or li.start_u + t.height_ru - 1 > r.rack_units
  limit 1;

  if found then
    raise exception
      'RB_BOUNDS: existing item % in layout % at U% with %U exceeds rack bounds 1..%U',
      v_violation.item_id,
      v_violation.layout_id,
      v_violation.start_u,
      v_violation.height_ru,
      v_violation.rack_units;
  end if;

  select
    a.id as item_a,
    b.id as item_b,
    a.layout_id,
    a.facing
  into v_violation
  from layout_items a
  join layout_items b
    on b.layout_id = a.layout_id
   and b.id > a.id
  join layouts l on l.id = a.layout_id
  join racks r on r.id = l.rack_id
  cross join lateral rb_layout_item_traits(a.device_id, a.panel_layout_id) ta
  cross join lateral rb_layout_item_traits(b.device_id, b.panel_layout_id) tb
  cross join lateral rb_layout_item_slot(r.width, a.preferred_lane, a.preferred_sub_lane, ta.is_half_rack, a.force_full_width) sa
  cross join lateral rb_layout_item_slot(r.width, b.preferred_lane, b.preferred_sub_lane, tb.is_half_rack, b.force_full_width) sb
  where a.facing = b.facing
    and rb_u_ranges_overlap(a.start_u, ta.height_ru, b.start_u, tb.height_ru)
    and rb_slots_conflict(sa.outer_lane, sa.inner_lane, sb.outer_lane, sb.inner_lane)
  limit 1;

  if found then
    raise exception
      'RB_SLOT: existing items % and % overlap on facing % in layout %',
      v_violation.item_a,
      v_violation.item_b,
      v_violation.facing,
      v_violation.layout_id;
  end if;

  select
    a.id as item_a,
    b.id as item_b,
    a.layout_id,
    ta.depth_mm as depth_a,
    tb.depth_mm as depth_b,
    r.depth_mm as rack_depth
  into v_violation
  from layout_items a
  join layout_items b
    on b.layout_id = a.layout_id
   and b.id > a.id
  join layouts l on l.id = a.layout_id
  join racks r on r.id = l.rack_id
  cross join lateral rb_layout_item_traits(a.device_id, a.panel_layout_id) ta
  cross join lateral rb_layout_item_traits(b.device_id, b.panel_layout_id) tb
  cross join lateral rb_layout_item_slot(r.width, a.preferred_lane, a.preferred_sub_lane, ta.is_half_rack, a.force_full_width) sa
  cross join lateral rb_layout_item_slot(r.width, b.preferred_lane, b.preferred_sub_lane, tb.is_half_rack, b.force_full_width) sb
  where a.facing <> b.facing
    and rb_u_ranges_overlap(a.start_u, ta.height_ru, b.start_u, tb.height_ru)
    and rb_slots_conflict(sa.outer_lane, sa.inner_lane, sb.outer_lane, sb.inner_lane)
    and (ta.depth_mm + tb.depth_mm) > r.depth_mm
  limit 1;

  if found then
    raise exception
      'RB_DEPTH: existing items % and % collide (%mm + %mm > %mm) in layout %',
      v_violation.item_a,
      v_violation.item_b,
      v_violation.depth_a,
      v_violation.depth_b,
      v_violation.rack_depth,
      v_violation.layout_id;
  end if;
end
$$;

drop trigger if exists trg_rb_validate_layout_item_semantics on layout_items;

create trigger trg_rb_validate_layout_item_semantics
before insert or update on layout_items
for each row
execute function rb_validate_layout_item_semantics();
