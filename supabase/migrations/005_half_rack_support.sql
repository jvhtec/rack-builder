-- Half-rack width device support
-- Devices can be flagged as half-rack width (~9.5" in a standard 19" rack)
alter table devices
add column is_half_rack boolean not null default false;

-- Sub-lane within a dual-rack column for half-rack devices (0 = left half, 1 = right half)
alter table layout_items
add column preferred_sub_lane integer null check (preferred_sub_lane in (0, 1));

-- Force a half-rack device to render at full column width (placed with shelf or custom ears)
alter table layout_items
add column force_full_width boolean not null default false;
