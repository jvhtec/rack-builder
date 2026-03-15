alter table if exists connectors
  add column if not exists is_d_size boolean not null default false;

do $$
begin
  if to_regclass('public.connectors') is null then
    return;
  end if;

  update connectors
  set is_d_size = true
  where id in ('xlr_d_series', 'ethercon_rj45', 'speakon_d', 'bnc_d');

  update connectors
  set is_d_size = false
  where id = 'powercon_true1';
end
$$;
