alter table devices
add column if not exists invert_image_in_dark_mode boolean not null default false;
