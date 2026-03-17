-- Add optional password column to projects
alter table projects add column password text;

-- App-wide settings key-value store
create table app_settings (
  key   text primary key,
  value text
);

-- Seed the library password row (null = not yet configured)
insert into app_settings (key, value) values ('library_password', null);
