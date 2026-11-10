-- ============================================================
-- Mehrere Lehrpersonen, Schritt 1c: Wem gehört ein neuer Eintrag?
--
-- Jeder Schüler gehört genau einer Lehrperson (profiles.teacher_id). Alles,
-- was zu einem Schüler entsteht (Termin, Abo, Anfrage, Vorschlag,
-- Verschiebung, Ausfall, Notiz, Schüler-Abwesenheit), gehört darum
-- derselben Lehrperson.
--
-- Die Spaltenvorgabe aus Migration 071 setzt immer David. Ohne diesen
-- Trigger bekäme ein Termin für einen Schüler von Lehrperson Anna Davids
-- teacher_id, weil der bestehende Code die Spalte nicht kennt. Der Trigger
-- übernimmt die Lehrperson vom Schüler, an einer einzigen Stelle, statt
-- dass jede der vielen Einfüge-Stellen im Code daran denken muss.
--
-- Hat ein Schüler (noch) keine Lehrperson, bleibt es bei der Vorgabe
-- (David).
-- ============================================================

create or replace function public.teacher_vom_schueler()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  t uuid;
begin
  if new.student_id is not null then
    select teacher_id into t from profiles where id = new.student_id;
    if t is not null then
      new.teacher_id := t;
    end if;
  end if;
  return new;
end $$;

do $$
declare
  tab text;
begin
  foreach tab in array array[
    'appointments', 'packages', 'booking_requests', 'proposals',
    'reschedule_requests', 'lesson_ausfaelle', 'lektionsnotizen'
  ] loop
    execute format('drop trigger if exists teacher_vom_schueler on public.%I', tab);
    execute format(
      'create trigger teacher_vom_schueler before insert on public.%I for each row execute function public.teacher_vom_schueler()',
      tab
    );
  end loop;
end $$;

-- Abwesenheiten: nur die eines Schülers. Eine Abwesenheit einer Lehrperson
-- (scope 'admin') behält die Lehrperson, für die sie eingetragen wurde.
create or replace function public.teacher_vom_schueler_abwesenheit()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  t uuid;
begin
  if new.scope = 'student' and new.student_id is not null then
    select teacher_id into t from profiles where id = new.student_id;
    if t is not null then
      new.teacher_id := t;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists teacher_vom_schueler on public.absences;
create trigger teacher_vom_schueler before insert on public.absences
  for each row execute function public.teacher_vom_schueler_abwesenheit();
