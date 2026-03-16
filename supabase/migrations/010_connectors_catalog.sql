create table if not exists connectors (
  id text primary key,
  name text not null,
  category text not null check (category in ('audio', 'data', 'power', 'multipin', 'other')),
  image_path text not null,
  grid_width integer not null check (grid_width > 0),
  grid_height integer not null check (grid_height > 0),
  mounting text not null check (mounting in ('front', 'rear', 'both')),
  notes text not null default '',
  weight_kg double precision not null default 0 check (weight_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists connectors_category_idx on connectors (category);
create index if not exists connectors_name_idx on connectors (name);

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists connectors_set_updated_at on connectors;
create trigger connectors_set_updated_at
before update on connectors
for each row execute function update_updated_at_column();

insert into connectors (id, name, category, image_path, grid_width, grid_height, mounting, notes, weight_kg)
values
  ('xlr_d_series', 'XLR (D-Series)', 'audio', '/connectors/d-series.svg', 1, 1, 'both', 'Unified 24 mm D-size cut-out.', 0.07),
  ('ethercon_rj45', 'RJ45 / etherCON', 'data', '/connectors/rj45.svg', 1, 1, 'both', 'D-size shell with RJ45 insert.', 0.06),
  ('powercon_true1', 'powerCON TRUE1', 'power', '/connectors/powercon.svg', 1, 2, 'front', 'Locking release tab, front mounting only.', 0.12),
  ('speakon_d', 'speakON (D-Series)', 'audio', '/connectors/d-series.svg', 1, 1, 'both', 'Speaker connector in D-size format.', 0.08),
  ('bnc_d', 'BNC (D-Series)', 'data', '/connectors/d-series.svg', 1, 1, 'both', 'Coax connector in D-size format.', 0.05),
  ('soca_lk37', 'Socapex / LK37', 'multipin', '/connectors/socapex.svg', 2, 2, 'front', 'Approx. 46 mm mounting hole.', 0.35),
  ('cee_16a', 'CEE 16A', 'power', '/connectors/cee.svg', 2, 3, 'front', 'Industrial power connector.', 0.42),
  ('blank_insert', 'Blank Insert', 'other', '/connectors/blank.svg', 1, 1, 'both', 'Filler for unused holes.', 0.02)
on conflict (id) do update
set name = excluded.name,
    category = excluded.category,
    image_path = excluded.image_path,
    grid_width = excluded.grid_width,
    grid_height = excluded.grid_height,
    mounting = excluded.mounting,
    notes = excluded.notes,
    weight_kg = excluded.weight_kg,
    updated_at = now();
