alter table layout_items
add column if not exists rack_ear_offset_mm numeric not null default 0;
