alter table layout_items
add column if not exists rack_ear_offset_mm numeric not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'layout_items_rack_ear_offset_mm_nonneg'
      and conrelid = 'public.layout_items'::regclass
  ) then
    alter table public.layout_items
      add constraint layout_items_rack_ear_offset_mm_nonneg
      check (rack_ear_offset_mm >= 0);
  end if;
end $$;
