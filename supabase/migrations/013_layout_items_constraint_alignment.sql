-- Remove legacy layout_items overlap constraints that block valid front/rear same-U placements.
-- Current editor logic allows opposite-side occupancy when depth fits, so backend rules
-- must not enforce layout_id + start_u uniqueness across both mount sides.

do $$
declare
  rec record;
  constraint_def text;
  normalized_def text;
begin
  for rec in
    select c.oid, c.conname, c.contype
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'layout_items'
      and c.contype in ('u', 'x')
  loop
    constraint_def := pg_get_constraintdef(rec.oid);
    normalized_def := regexp_replace(constraint_def, '\s+', ' ', 'g');

    -- Offending legacy exclusion rule: overlap/range checks that do not scope by facing.
    if rec.contype = 'x'
      and (
        normalized_def ilike '%int4range(start_u%'
        or normalized_def ilike '%&&%'
        or normalized_def ilike '%start_u with =%'
      )
      and normalized_def not ilike '%facing with =%'
    then
      execute format('alter table public.layout_items drop constraint %I', rec.conname);
      continue;
    end if;

    -- Offending legacy unique rule: blocks one item per U regardless of mount side.
    if rec.contype = 'u'
      and normalized_def ilike 'UNIQUE (layout_id, start_u)%'
    then
      execute format('alter table public.layout_items drop constraint %I', rec.conname);
    end if;
  end loop;
end $$;
