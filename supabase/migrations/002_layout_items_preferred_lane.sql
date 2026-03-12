alter table layout_items
add column preferred_lane integer null check (preferred_lane in (0, 1));
