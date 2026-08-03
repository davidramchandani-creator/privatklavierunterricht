-- Migration 022: packages.lessons_used automatisch mit appointments synchronisieren.
-- Behebt: lessons_used wurde nirgends aktualisiert -> Server-Checks (Restlektionen,
-- canBuyNewPackage) rechneten immer mit 0 verbrauchten Lektionen.
-- (Bereits am 2026-08-03 direkt auf der Live-DB angewendet.)

create or replace function public.sync_package_lessons_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  old_pid uuid;
begin
  pid := coalesce(
    case when tg_op = 'DELETE' then old.package_id else new.package_id end,
    null
  );

  if pid is not null then
    update public.packages p
    set lessons_used = (
      select count(*) from public.appointments a
      where a.package_id = pid and a.status in ('booked', 'completed')
    )
    where p.id = pid;
  end if;

  if tg_op = 'UPDATE' and new.package_id is distinct from old.package_id then
    old_pid := old.package_id;
    if old_pid is not null then
      update public.packages p
      set lessons_used = (
        select count(*) from public.appointments a
        where a.package_id = old_pid and a.status in ('booked', 'completed')
      )
      where p.id = old_pid;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists appointments_sync_lessons_used on public.appointments;
create trigger appointments_sync_lessons_used
after insert or update or delete on public.appointments
for each row execute function public.sync_package_lessons_used();

-- Backfill: aktuelle Zaehlerstaende korrigieren.
update public.packages p
set lessons_used = (
  select count(*) from public.appointments a
  where a.package_id = p.id and a.status in ('booked', 'completed')
);
