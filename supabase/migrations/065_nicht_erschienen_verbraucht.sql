-- ============================================================
-- Nicht erschienen: Die Lektion ist verloren
--
-- David, 29. Oktober 2026: Erscheint ein Schüler nicht, ist die Lektion
-- verloren. Bisher gab der Zähler sie dem Paket zurück, weil nur
-- „booked" und „completed" zählten. Jetzt zählt auch „no_show" als
-- verbraucht.
-- ============================================================

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
      where a.package_id = pid and a.status in ('booked', 'completed', 'no_show')
        and a.zusatzlektion = false
    )
    where p.id = pid;
  end if;

  if tg_op = 'UPDATE' and new.package_id is distinct from old.package_id then
    old_pid := old.package_id;
    if old_pid is not null then
      update public.packages p
      set lessons_used = (
        select count(*) from public.appointments a
        where a.package_id = old_pid and a.status in ('booked', 'completed', 'no_show')
          and a.zusatzlektion = false
      )
      where p.id = old_pid;
    end if;
  end if;

  return null;
end;
$$;

-- Bestehende Zählerstände nachziehen.
update public.packages p
set lessons_used = (
  select count(*) from public.appointments a
  where a.package_id = p.id and a.status in ('booked', 'completed', 'no_show')
    and a.zusatzlektion = false
);
