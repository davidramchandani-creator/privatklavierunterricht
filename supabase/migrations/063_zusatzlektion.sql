-- ============================================================
-- Zusatzlektion neben dem Abo
--
-- Emilie, 18. September 2026: Abo läuft, David will eine zusätzliche
-- Lektion einbuchen. Ein Einzellektion-Paket ging nicht, weil je Schüler
-- nur ein Paket aktiv ist, und die Direktbuchung hängte sie ans Abo, das
-- „keine Lektionen mehr übrig" hatte.
--
-- Eine Zusatzlektion hängt am Abo (damit Kalender, Erinnerungen und
-- Schülerseite sie wie jede andere zeigen), zählt aber nicht zu seinen
-- Lektionen und wird nach der Lektion einzeln abgerechnet, zum
-- Einzelpreis des Schülers (profiles.price_single).
-- ============================================================

alter table public.appointments
  add column if not exists zusatzlektion boolean not null default false;

comment on column public.appointments.zusatzlektion is
  'Zusätzlich zum Abo, zählt nicht zu dessen Lektionen, wird einzeln zum Einzelpreis abgerechnet.';

-- Der Zähler des Pakets lässt Zusatzlektionen aus.
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
        where a.package_id = old_pid and a.status in ('booked', 'completed')
          and a.zusatzlektion = false
      )
      where p.id = old_pid;
    end if;
  end if;

  return null;
end;
$$;
