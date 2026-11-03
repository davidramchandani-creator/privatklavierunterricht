-- ============================================================
-- Abos im Semesterrhythmus
--
-- David, 3. November 2026: Seit dem Studium an der PH Zürich bekommt David
-- jedes Semester einen neuen Stundenplan. Abos laufen darum von Semester zu
-- Semester, nicht mehr 6 oder 12 Monate ab Abschluss.
--
--   semester            Beginn und Ende jedes Semesters, von David gepflegt.
--   schulferien         Wird zu „unterrichtsfreie Zeiten": Davids Ferien und
--                       Praktika. Die Zürcher Schulferien gelten nicht mehr
--                       (Antwort David: „Nur PH-Ferien und Praktikum").
--   packages.bindung_bis Jahresabo: läuft zwei Semester, abgerechnet wird
--                       pro Semester. Bis zu diesem Datum ist keine
--                       Kündigung möglich.
-- ============================================================

create table if not exists public.semester (
  id uuid primary key default gen_random_uuid(),
  bezeichnung text not null,
  beginn date not null,
  ende date not null,
  erstellt_am timestamptz not null default now(),
  check (ende > beginn)
);

create index if not exists semester_zeitraum_idx on public.semester (beginn, ende);

comment on table public.semester is
  'Semester von Davids Studium. Ein Abo endet am Ende des Semesters, in dem es beginnt (Jahresabo: am Ende des nächsten).';

alter table public.semester enable row level security;

drop policy if exists "Alle lesen Semester" on public.semester;
create policy "Alle lesen Semester" on public.semester for select using (true);

drop policy if exists "Nur Admin pflegt Semester" on public.semester;
create policy "Nur Admin pflegt Semester" on public.semester
  for all using (is_admin()) with check (is_admin());

alter table public.packages add column if not exists bindung_bis date;

comment on column public.packages.bindung_bis is
  'Jahresabo: vertraglich gebunden bis zu diesem Tag (Ende des zweiten Semesters). Kündigung erst zum Ende dieser Bindung.';

comment on table public.schulferien is
  'Unterrichtsfreie Zeiten: Davids Ferien und Praktika laut PH-Semesterplan. In diesen Zeiträumen entstehen keine Abo-Termine.';

-- ── Die ersten zwei Semester (1. Ausbildungsjahr) ───────────────
insert into public.semester (bezeichnung, beginn, ende)
select * from (values
  ('HS26 / WZ27', date '2026-09-14', date '2027-02-21'),
  ('FS27 / SZ27', date '2027-02-22', date '2027-09-12')
) v(bezeichnung, beginn, ende)
where not exists (select 1 from public.semester s where s.beginn = v.beginn);

-- ── Unterrichtsfreie Zeiten statt Zürcher Schulferien ──────────
-- Vergangene Einträge bleiben (Herbstferien 2026), alles ab heute wird durch
-- die PH-Zeiten ersetzt.
delete from public.schulferien where end_datum >= date '2026-11-03';

insert into public.schulferien (bezeichnung, start_datum, end_datum) values
  ('Weihnachtsferien 2026/27', date '2026-12-21', date '2027-01-03'),
  ('Praktikum 1', date '2027-01-18', date '2027-02-07'),
  ('Osterferien 2027', date '2027-03-29', date '2027-04-04'),
  ('Sommerferien 2027', date '2027-07-26', date '2027-08-15');
