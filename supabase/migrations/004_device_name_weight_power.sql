alter table devices
add column weight_kg numeric(10,2) not null default 0,
add column power_w integer not null default 0;

alter table devices
add constraint devices_weight_kg_nonnegative check (weight_kg >= 0),
add constraint devices_power_w_nonnegative check (power_w >= 0);

alter table layout_items
add column custom_name text;
