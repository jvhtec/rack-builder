create type drawing_state as enum ('preliminary', 'rev', 'as_built');

alter table projects
add column drawing_state drawing_state not null default 'preliminary',
add column revision_number integer not null default 0 check (revision_number >= 0);

alter table layouts
add column drawing_state drawing_state not null default 'preliminary',
add column revision_number integer not null default 0 check (revision_number >= 0);

create or replace function set_drawing_revision_on_update()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    if new.drawing_state = 'rev' then
      new.revision_number := old.revision_number + 1;
    elsif old.drawing_state = 'rev' and new.drawing_state is distinct from old.drawing_state then
      new.revision_number := old.revision_number;
    else
      new.revision_number := old.revision_number;
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists projects_drawing_revision_trigger on projects;
create trigger projects_drawing_revision_trigger
before update on projects
for each row
execute function set_drawing_revision_on_update();

drop trigger if exists layouts_drawing_revision_trigger on layouts;
create trigger layouts_drawing_revision_trigger
before update on layouts
for each row
execute function set_drawing_revision_on_update();
